import type { Express, Request, Response } from "express";
import {
  TEMPLATE_CATALOG,
  getTemplateById,
  getTemplatesByCategory,
  getFeaturedTemplates,
  type Template,
  type TemplateCategory,
} from "@shared/templateCatalog";

// ---------------------------------------------------------------------------
// In-memory download counters (not persisted across restarts)
// ---------------------------------------------------------------------------
const downloadCounts: Record<string, number> = {};

// ---------------------------------------------------------------------------
// CRC-32 implementation (IEEE / ISO 3309 polynomial)
// ---------------------------------------------------------------------------
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Minimal PKZip generator (Store method – no compression)
//
// Spec references:
//   Local file header      – signature 0x04034b50
//   Central directory entry – signature 0x02014b50
//   End of central dir     – signature 0x06054b50
// ---------------------------------------------------------------------------
interface ZipEntry {
  filename: string;
  data: Buffer;
}

function createZipBuffer(files: Record<string, string>): Buffer {
  const entries: ZipEntry[] = Object.entries(files).map(([filename, content]) => ({
    filename,
    data: Buffer.from(content, "utf-8"),
  }));

  // Use a fixed DOS date/time so output is deterministic
  const dosTime = 0x0000; // 00:00:00
  const dosDate = 0x0021; // 1980-01-01

  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.filename, "utf-8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // --- Local file header (30 bytes + filename + file data) ---
    const local = Buffer.alloc(30 + filenameBuf.length + size);
    local.writeUInt32LE(0x04034b50, 0);   // Signature
    local.writeUInt16LE(20, 4);            // Version needed (2.0)
    local.writeUInt16LE(0, 6);             // General purpose bit flag
    local.writeUInt16LE(0, 8);             // Compression method (0 = store)
    local.writeUInt16LE(dosTime, 10);      // Last mod file time
    local.writeUInt16LE(dosDate, 12);      // Last mod file date
    local.writeUInt32LE(crc, 14);          // CRC-32
    local.writeUInt32LE(size, 18);         // Compressed size
    local.writeUInt32LE(size, 22);         // Uncompressed size
    local.writeUInt16LE(filenameBuf.length, 26); // Filename length
    local.writeUInt16LE(0, 28);            // Extra field length
    filenameBuf.copy(local, 30);
    entry.data.copy(local, 30 + filenameBuf.length);

    // --- Central directory header (46 bytes + filename) ---
    const central = Buffer.alloc(46 + filenameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);  // Signature
    central.writeUInt16LE(20, 4);          // Version made by
    central.writeUInt16LE(20, 6);          // Version needed
    central.writeUInt16LE(0, 8);           // General purpose bit flag
    central.writeUInt16LE(0, 10);          // Compression method
    central.writeUInt16LE(dosTime, 12);    // Last mod file time
    central.writeUInt16LE(dosDate, 14);    // Last mod file date
    central.writeUInt32LE(crc, 16);        // CRC-32
    central.writeUInt32LE(size, 20);       // Compressed size
    central.writeUInt32LE(size, 24);       // Uncompressed size
    central.writeUInt16LE(filenameBuf.length, 28); // Filename length
    central.writeUInt16LE(0, 30);          // Extra field length
    central.writeUInt16LE(0, 32);          // File comment length
    central.writeUInt16LE(0, 34);          // Disk number start
    central.writeUInt16LE(0, 36);          // Internal file attributes
    central.writeUInt32LE(0, 38);          // External file attributes
    central.writeUInt32LE(offset, 42);     // Relative offset of local header
    filenameBuf.copy(central, 46);

    localHeaders.push(local);
    centralHeaders.push(central);
    offset += local.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, buf) => sum + buf.length, 0);

  // --- End of central directory record (22 bytes) ---
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);               // Signature
  endRecord.writeUInt16LE(0, 4);                          // Disk number
  endRecord.writeUInt16LE(0, 6);                          // Disk with central dir
  endRecord.writeUInt16LE(entries.length, 8);             // Entries on this disk
  endRecord.writeUInt16LE(entries.length, 10);            // Total entries
  endRecord.writeUInt32LE(centralDirSize, 12);            // Size of central dir
  endRecord.writeUInt32LE(centralDirOffset, 16);          // Offset of central dir
  endRecord.writeUInt16LE(0, 20);                         // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, endRecord]);
}

// ---------------------------------------------------------------------------
// Helper: inline CSS into an HTML string so previews are self-contained
// ---------------------------------------------------------------------------
function inlineCssIntoHtml(
  html: string,
  cssFiles: { path: string; content: string }[]
): string {
  if (cssFiles.length === 0) return html;

  const styleBlock = cssFiles
    .map((f) => `/* ${f.path} */\n${f.content}`)
    .join("\n\n");

  const styleTag = `<style>\n${styleBlock}\n</style>`;

  // Insert before </head> if present, otherwise before </body>, otherwise append
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${styleTag}\n</body>`);
  }
  return html + "\n" + styleTag;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerTemplateRoutes(app: Express): void {
  // -----------------------------------------------------------------------
  // GET /api/templates
  // List templates (without file contents). Supports filtering by category,
  // featured flag, and free-text search.
  // -----------------------------------------------------------------------
  app.get("/api/templates", (req: Request, res: Response) => {
    try {
      const { category, featured, search } = req.query;

      let templates: Template[] = [...TEMPLATE_CATALOG];

      // Filter by category
      if (category && typeof category === "string") {
        templates = getTemplatesByCategory(category as TemplateCategory);
      }

      // Filter featured
      if (featured === "true") {
        templates = templates.filter((t) =>
          getFeaturedTemplates().some((f) => f.id === t.id)
        );
      }

      // Free-text search across name, description, and tags
      if (search && typeof search === "string") {
        const q = search.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(q)))
        );
      }

      // Map to listing view: omit `files`, add `fileCount`
      const listing = templates.map(({ files, ...rest }) => ({
        ...rest,
        fileCount: Object.keys(files).length,
        downloads: downloadCounts[rest.id] ?? 0,
      }));

      res.json(listing);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/templates/:id
  // Full metadata for a single template (file paths listed, contents omitted)
  // -----------------------------------------------------------------------
  app.get("/api/templates/:id", (req: Request, res: Response) => {
    try {
      const template = getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const { files, ...rest } = template;
      res.json({
        ...rest,
        fileCount: Object.keys(files).length,
        filePaths: Object.keys(files),
        downloads: downloadCounts[rest.id] ?? 0,
      });
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/templates/:id/preview
  // Returns the main HTML with CSS inlined for standalone iframe preview.
  // -----------------------------------------------------------------------
  app.get("/api/templates/:id/preview", (req: Request, res: Response) => {
    try {
      const template = getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Find the primary HTML file (prefer index.html)
      const htmlPath = Object.keys(template.files).find(
        (p) => p.endsWith("index.html") || p.endsWith(".html")
      );

      if (!htmlPath) {
        return res
          .status(404)
          .json({ message: "No HTML file found in template" });
      }

      const htmlContent = template.files[htmlPath];

      // Gather all CSS files to inline
      const cssFiles = Object.entries(template.files)
        .filter(([p]) => p.endsWith(".css"))
        .map(([p, content]) => ({ path: p, content }));

      const finalHtml = inlineCssIntoHtml(htmlContent, cssFiles);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(finalHtml);
    } catch (error) {
      console.error("Error generating template preview:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // -----------------------------------------------------------------------
  // GET /api/templates/:id/download
  // Generates a .zip containing all template files and serves it.
  // -----------------------------------------------------------------------
  app.get("/api/templates/:id/download", (req: Request, res: Response) => {
    try {
      const template = getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const zipBuffer = createZipBuffer(template.files);

      // Sanitise the template name for use as a filename
      const safeName = template.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.zip"`
      );
      res.setHeader("Content-Length", zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error generating template download:", error);
      res.status(500).json({ message: "Failed to generate download" });
    }
  });

  // -----------------------------------------------------------------------
  // POST /api/templates/:id/track-download
  // Increments the in-memory download counter for a template.
  // -----------------------------------------------------------------------
  app.post("/api/templates/:id/track-download", (req: Request, res: Response) => {
    try {
      const template = getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      downloadCounts[template.id] = (downloadCounts[template.id] ?? 0) + 1;

      res.json({
        id: template.id,
        downloads: downloadCounts[template.id],
      });
    } catch (error) {
      console.error("Error tracking download:", error);
      res.status(500).json({ message: "Failed to track download" });
    }
  });
}
