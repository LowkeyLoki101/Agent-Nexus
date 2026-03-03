export type TemplateCategory = "landing-page" | "portfolio" | "saas" | "ecommerce" | "dashboard" | "blog";
export type TemplatePlatform = "replit" | "lovable" | "vercel" | "netlify" | "any";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  platforms: TemplatePlatform[];
  tags: string[];
  thumbnail: string;
  framework: string;
  version: string;
  fileCount: number;
  downloadCount: number;
  createdAt: string;
  featured: boolean;
  files: Record<string, string>;
}

export const TEMPLATE_CATALOG: Template[] = [
  {
    id: "modern-saas-landing",
    name: "Modern SaaS Landing Page",
    description: "A polished, conversion-focused landing page for SaaS products with hero section, feature grid, pricing cards, testimonials, and call-to-action sections. Fully responsive and ready to customize.",
    category: "landing-page",
    platforms: ["replit", "lovable", "vercel", "netlify", "any"],
    tags: ["responsive", "modern", "saas", "startup", "landing"],
    thumbnail: "linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #3b82f6 70%, #60a5fa 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 2,
    downloadCount: 0,
    createdAt: "2026-02-15T00:00:00Z",
    featured: true,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SaaS Product</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav">
  <div class="container nav-inner">
    <a href="#" class="logo">Acme<span>Pro</span></a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#testimonials">Testimonials</a>
      <a href="#" class="btn btn-sm">Get Started</a>
    </div>
  </div>
</nav>
<header class="hero">
  <div class="container hero-inner">
    <h1>Build better products,<br><span class="gradient-text">faster than ever</span></h1>
    <p class="hero-sub">The all-in-one platform that helps teams ship features 10x faster with AI-powered workflows, real-time collaboration, and automated testing.</p>
    <div class="hero-actions">
      <a href="#" class="btn btn-lg">Start Free Trial</a>
      <a href="#" class="btn btn-outline btn-lg">Watch Demo</a>
    </div>
    <p class="hero-note">No credit card required &middot; 14-day free trial</p>
  </div>
</header>
<section id="features" class="section">
  <div class="container">
    <h2 class="section-title">Everything you need to ship</h2>
    <p class="section-sub">Powerful features that streamline your entire development workflow.</p>
    <div class="grid-3">
      <div class="feature-card">
        <div class="feature-icon">&#9889;</div>
        <h3>Lightning Fast</h3>
        <p>Optimized performance with edge computing and smart caching for sub-second response times.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">&#128274;</div>
        <h3>Enterprise Security</h3>
        <p>SOC 2 compliant with end-to-end encryption, SSO, and role-based access controls.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">&#128640;</div>
        <h3>AI Workflows</h3>
        <p>Automate repetitive tasks with intelligent agents that learn from your team's patterns.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">&#128202;</div>
        <h3>Analytics Dashboard</h3>
        <p>Real-time insights into your team's productivity, deployment frequency, and code quality.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">&#129309;</div>
        <h3>Team Collaboration</h3>
        <p>Built-in code reviews, async discussions, and shared workspaces for distributed teams.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">&#128736;</div>
        <h3>Developer Tools</h3>
        <p>CLI, API, webhooks, and integrations with GitHub, GitLab, Jira, Slack, and 50+ tools.</p>
      </div>
    </div>
  </div>
</section>
<section id="pricing" class="section section-alt">
  <div class="container">
    <h2 class="section-title">Simple, transparent pricing</h2>
    <p class="section-sub">Start free, upgrade when you're ready. No hidden fees.</p>
    <div class="grid-3 pricing-grid">
      <div class="price-card">
        <h3>Starter</h3>
        <div class="price">$0<span>/mo</span></div>
        <ul><li>Up to 3 users</li><li>5 projects</li><li>Community support</li><li>Basic analytics</li></ul>
        <a href="#" class="btn btn-outline">Get Started</a>
      </div>
      <div class="price-card price-card-featured">
        <div class="price-badge">Most Popular</div>
        <h3>Pro</h3>
        <div class="price">$29<span>/mo</span></div>
        <ul><li>Unlimited users</li><li>Unlimited projects</li><li>Priority support</li><li>Advanced analytics</li><li>AI workflows</li></ul>
        <a href="#" class="btn btn-lg">Start Free Trial</a>
      </div>
      <div class="price-card">
        <h3>Enterprise</h3>
        <div class="price">Custom</div>
        <ul><li>Everything in Pro</li><li>SSO &amp; SAML</li><li>Dedicated support</li><li>SLA guarantee</li><li>Custom integrations</li></ul>
        <a href="#" class="btn btn-outline">Contact Sales</a>
      </div>
    </div>
  </div>
</section>
<section id="testimonials" class="section">
  <div class="container">
    <h2 class="section-title">Loved by teams worldwide</h2>
    <div class="grid-3">
      <div class="testimonial-card">
        <p>"This platform cut our deployment time from hours to minutes. The AI workflows are a game-changer."</p>
        <div class="testimonial-author"><strong>Sarah Chen</strong><span>CTO, TechFlow</span></div>
      </div>
      <div class="testimonial-card">
        <p>"We've been able to ship 3x more features since adopting this tool. The collaboration features are unmatched."</p>
        <div class="testimonial-author"><strong>Marcus Johnson</strong><span>VP Engineering, DataScale</span></div>
      </div>
      <div class="testimonial-card">
        <p>"The best developer experience I've ever used. Our team onboarding went from 2 weeks to 2 days."</p>
        <div class="testimonial-author"><strong>Aisha Patel</strong><span>Lead Dev, CloudFirst</span></div>
      </div>
    </div>
  </div>
</section>
<section class="cta-section">
  <div class="container cta-inner">
    <h2>Ready to build faster?</h2>
    <p>Join 10,000+ teams already shipping with confidence.</p>
    <a href="#" class="btn btn-lg btn-white">Start Your Free Trial</a>
  </div>
</section>
<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-col"><a href="#" class="logo">Acme<span>Pro</span></a><p>Build better products, faster.</p></div>
    <div class="footer-col"><h4>Product</h4><a href="#">Features</a><a href="#">Pricing</a><a href="#">Changelog</a></div>
    <div class="footer-col"><h4>Company</h4><a href="#">About</a><a href="#">Blog</a><a href="#">Careers</a></div>
    <div class="footer-col"><h4>Legal</h4><a href="#">Privacy</a><a href="#">Terms</a></div>
  </div>
  <div class="container footer-bottom"><p>&copy; 2026 AcmePro. All rights reserved.</p></div>
</footer>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#3b82f6;--primary-dark:#2563eb;--bg:#0f172a;--bg-alt:#1e293b;--text:#e2e8f0;--text-muted:#94a3b8;--border:#334155;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(12px);background:rgba(15,23,42,.8);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-size:1.25rem;font-weight:700;color:var(--text);text-decoration:none}
.logo span{color:var(--primary)}
.nav-links{display:flex;align-items:center;gap:24px}
.nav-links a{color:var(--text-muted);text-decoration:none;font-size:.875rem;transition:color .2s}
.nav-links a:hover{color:var(--text)}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 20px;border-radius:var(--radius);font-weight:600;font-size:.875rem;text-decoration:none;transition:all .2s;cursor:pointer;border:none;background:var(--primary);color:#fff}
.btn:hover{background:var(--primary-dark);transform:translateY(-1px)}
.btn-sm{padding:6px 14px;font-size:.8rem}
.btn-lg{padding:14px 28px;font-size:1rem}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary);background:transparent}
.btn-white{background:#fff;color:var(--bg)}
.btn-white:hover{background:#e2e8f0}
.hero{padding:140px 0 80px;text-align:center}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:800;line-height:1.1;margin-bottom:24px}
.gradient-text{background:linear-gradient(135deg,var(--primary),#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{font-size:1.125rem;color:var(--text-muted);max-width:600px;margin:0 auto 32px}
.hero-actions{display:flex;gap:16px;justify-content:center;margin-bottom:16px}
.hero-note{font-size:.8rem;color:var(--text-muted)}
.section{padding:80px 0}
.section-alt{background:var(--bg-alt)}
.section-title{font-size:2rem;font-weight:700;text-align:center;margin-bottom:12px}
.section-sub{text-align:center;color:var(--text-muted);margin-bottom:48px;max-width:500px;margin-left:auto;margin-right:auto}
.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.feature-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:28px;transition:border-color .2s}
.feature-card:hover{border-color:var(--primary)}
.feature-icon{font-size:2rem;margin-bottom:12px}
.feature-card h3{font-size:1.1rem;margin-bottom:8px}
.feature-card p{color:var(--text-muted);font-size:.9rem}
.price-card{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:32px;text-align:center;position:relative}
.price-card h3{font-size:1.25rem;margin-bottom:8px}
.price{font-size:3rem;font-weight:800;margin:16px 0}
.price span{font-size:1rem;color:var(--text-muted);font-weight:400}
.price-card ul{list-style:none;text-align:left;margin:24px 0;font-size:.9rem;color:var(--text-muted)}
.price-card ul li{padding:8px 0;border-bottom:1px solid var(--border)}
.price-card ul li::before{content:"\\2713 ";color:var(--primary);font-weight:700}
.price-card-featured{border-color:var(--primary);background:linear-gradient(180deg,rgba(59,130,246,.08),transparent)}
.price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;padding:4px 16px;border-radius:20px;font-size:.75rem;font-weight:600}
.testimonial-card{background:var(--bg-alt);border:1px solid var(--border);border-radius:12px;padding:24px}
.testimonial-card p{font-style:italic;color:var(--text-muted);margin-bottom:16px;font-size:.95rem}
.testimonial-author{display:flex;flex-direction:column}
.testimonial-author strong{font-size:.9rem}
.testimonial-author span{font-size:.8rem;color:var(--text-muted)}
.cta-section{padding:80px 0;background:linear-gradient(135deg,var(--primary-dark),#7c3aed);text-align:center}
.cta-inner h2{font-size:2rem;margin-bottom:12px}
.cta-inner p{color:rgba(255,255,255,.8);margin-bottom:24px}
.footer{padding:48px 0 24px;border-top:1px solid var(--border)}
.footer-inner{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:32px;margin-bottom:32px}
.footer-col h4{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:12px}
.footer-col a{display:block;color:var(--text-muted);text-decoration:none;font-size:.875rem;padding:4px 0;transition:color .2s}
.footer-col a:hover{color:var(--text)}
.footer-col p{color:var(--text-muted);font-size:.875rem;margin-top:8px}
.footer-bottom{border-top:1px solid var(--border);padding-top:24px}
.footer-bottom p{font-size:.8rem;color:var(--text-muted)}
@media(max-width:768px){.nav-links{display:none}.grid-3{grid-template-columns:1fr}.footer-inner{grid-template-columns:1fr}.hero-actions{flex-direction:column;align-items:center}.pricing-grid{gap:16px}}`
    },
  },
  {
    id: "developer-portfolio",
    name: "Developer Portfolio",
    description: "A sleek dark-themed portfolio for developers and designers. Includes about section, project grid, skills visualization, and contact form. Optimized for showcasing technical work.",
    category: "portfolio",
    platforms: ["replit", "lovable", "vercel", "netlify", "any"],
    tags: ["portfolio", "developer", "personal", "dark-mode"],
    thumbnail: "linear-gradient(135deg, #1a1a2e 0%, #2d1b69 50%, #5b21b6 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 2,
    downloadCount: 0,
    createdAt: "2026-02-18T00:00:00Z",
    featured: true,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Developer Portfolio</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="#" class="name">JD</a><div class="nav-links"><a href="#about">About</a><a href="#projects">Projects</a><a href="#skills">Skills</a><a href="#contact">Contact</a></div></div></nav>
<header class="hero"><div class="container"><p class="hero-label">Hello, I'm</p><h1>Jane Developer</h1><p class="hero-sub">Full-stack engineer passionate about building beautiful, performant web applications. Currently crafting developer tools at scale.</p><div class="hero-actions"><a href="#projects" class="btn">View My Work</a><a href="#contact" class="btn btn-outline">Get In Touch</a></div></div></header>
<section id="about" class="section"><div class="container"><h2>About Me</h2><div class="about-grid"><div class="about-text"><p>I'm a full-stack developer with 5+ years of experience building web applications. I specialize in React, Node.js, and cloud architecture.</p><p>When I'm not coding, you'll find me contributing to open source, writing technical articles, or exploring new technologies.</p></div><div class="about-stats"><div class="stat"><span class="stat-num">50+</span><span class="stat-label">Projects</span></div><div class="stat"><span class="stat-num">5+</span><span class="stat-label">Years Exp</span></div><div class="stat"><span class="stat-num">20+</span><span class="stat-label">Clients</span></div></div></div></div></section>
<section id="projects" class="section section-alt"><div class="container"><h2>Featured Projects</h2><div class="project-grid"><div class="project-card"><div class="project-img" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6)"><span>01</span></div><h3>Cloud Dashboard</h3><p>Real-time infrastructure monitoring dashboard built with React and D3.js</p><div class="project-tags"><span>React</span><span>D3.js</span><span>AWS</span></div></div><div class="project-card"><div class="project-img" style="background:linear-gradient(135deg,#10b981,#06b6d4)"><span>02</span></div><h3>AI Code Assistant</h3><p>VS Code extension using LLMs for intelligent code suggestions</p><div class="project-tags"><span>TypeScript</span><span>AI/ML</span><span>VS Code</span></div></div><div class="project-card"><div class="project-img" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><span>03</span></div><h3>E-Commerce Platform</h3><p>Scalable marketplace with real-time inventory and payment processing</p><div class="project-tags"><span>Next.js</span><span>Stripe</span><span>PostgreSQL</span></div></div><div class="project-card"><div class="project-img" style="background:linear-gradient(135deg,#ec4899,#8b5cf6)"><span>04</span></div><h3>Design System</h3><p>Component library with 60+ accessible, themeable UI components</p><div class="project-tags"><span>React</span><span>Storybook</span><span>A11y</span></div></div></div></div></section>
<section id="skills" class="section"><div class="container"><h2>Skills & Technologies</h2><div class="skills-grid"><div class="skill-group"><h3>Frontend</h3><div class="skill-tags"><span>React</span><span>TypeScript</span><span>Next.js</span><span>Tailwind CSS</span><span>Vue.js</span></div></div><div class="skill-group"><h3>Backend</h3><div class="skill-tags"><span>Node.js</span><span>Python</span><span>PostgreSQL</span><span>Redis</span><span>GraphQL</span></div></div><div class="skill-group"><h3>DevOps</h3><div class="skill-tags"><span>AWS</span><span>Docker</span><span>CI/CD</span><span>Terraform</span><span>K8s</span></div></div><div class="skill-group"><h3>Tools</h3><div class="skill-tags"><span>Git</span><span>Figma</span><span>VS Code</span><span>Jira</span><span>Notion</span></div></div></div></div></section>
<section id="contact" class="section section-alt"><div class="container"><h2>Get In Touch</h2><p class="section-sub">Have a project in mind? Let's talk about how I can help.</p><form class="contact-form"><div class="form-row"><div class="form-group"><label>Name</label><input type="text" placeholder="Your name"></div><div class="form-group"><label>Email</label><input type="email" placeholder="your@email.com"></div></div><div class="form-group"><label>Message</label><textarea rows="5" placeholder="Tell me about your project..."></textarea></div><button type="submit" class="btn btn-lg">Send Message</button></form></div></section>
<footer class="footer"><div class="container footer-inner"><p>&copy; 2026 Jane Developer</p><div class="social-links"><a href="#">GitHub</a><a href="#">LinkedIn</a><a href="#">Twitter</a></div></div></footer>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#8b5cf6;--primary-dark:#7c3aed;--bg:#0a0a1a;--bg-alt:#111127;--card:#1a1a35;--text:#e2e8f0;--text-muted:#94a3b8;--border:#2d2d50;--radius:10px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(12px);background:rgba(10,10,26,.85);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:60px}
.name{font-size:1.5rem;font-weight:800;color:var(--primary);text-decoration:none}
.nav-links{display:flex;gap:24px}
.nav-links a{color:var(--text-muted);text-decoration:none;font-size:.875rem;transition:color .2s}
.nav-links a:hover{color:var(--primary)}
.btn{display:inline-flex;align-items:center;padding:12px 24px;border-radius:var(--radius);font-weight:600;font-size:.9rem;text-decoration:none;border:none;cursor:pointer;transition:all .2s;background:var(--primary);color:#fff}
.btn:hover{background:var(--primary-dark);transform:translateY(-1px)}
.btn-lg{padding:14px 32px}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary);background:transparent}
.hero{min-height:100vh;display:flex;align-items:center;padding-top:60px}
.hero-label{font-size:.9rem;color:var(--primary);font-weight:600;margin-bottom:8px}
.hero h1{font-size:clamp(2.5rem,6vw,4rem);font-weight:800;margin-bottom:20px;line-height:1.1}
.hero-sub{font-size:1.1rem;color:var(--text-muted);max-width:550px;margin-bottom:32px}
.hero-actions{display:flex;gap:16px}
.section{padding:100px 0}
.section-alt{background:var(--bg-alt)}
.section h2{font-size:2rem;font-weight:700;margin-bottom:40px;text-align:center}
.section-sub{text-align:center;color:var(--text-muted);margin:-24px auto 40px;max-width:450px}
.about-grid{display:grid;grid-template-columns:2fr 1fr;gap:40px;align-items:center}
.about-text p{color:var(--text-muted);margin-bottom:16px;font-size:.95rem}
.about-stats{display:flex;flex-direction:column;gap:20px}
.stat{text-align:center;padding:20px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border)}
.stat-num{display:block;font-size:2rem;font-weight:800;color:var(--primary)}
.stat-label{font-size:.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em}
.project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.project-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:transform .2s,border-color .2s}
.project-card:hover{transform:translateY(-4px);border-color:var(--primary)}
.project-img{height:160px;display:flex;align-items:center;justify-content:center}
.project-img span{font-size:3rem;font-weight:800;color:rgba(255,255,255,.3)}
.project-card h3{padding:16px 16px 8px;font-size:1rem}
.project-card p{padding:0 16px;font-size:.85rem;color:var(--text-muted)}
.project-tags{padding:12px 16px 16px;display:flex;gap:6px;flex-wrap:wrap}
.project-tags span{font-size:.7rem;padding:4px 10px;border-radius:20px;background:rgba(139,92,246,.15);color:var(--primary)}
.skills-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}
.skill-group{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px}
.skill-group h3{font-size:.9rem;margin-bottom:16px;color:var(--primary)}
.skill-tags{display:flex;gap:8px;flex-wrap:wrap}
.skill-tags span{font-size:.8rem;padding:6px 14px;border-radius:6px;background:var(--bg);border:1px solid var(--border)}
.contact-form{max-width:600px;margin:0 auto}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:.8rem;font-weight:600;margin-bottom:6px;color:var(--text-muted)}
.form-group input,.form-group textarea{width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.9rem;font-family:inherit;transition:border-color .2s}
.form-group input:focus,.form-group textarea:focus{outline:none;border-color:var(--primary)}
.footer{padding:24px 0;border-top:1px solid var(--border)}
.footer-inner{display:flex;align-items:center;justify-content:space-between}
.footer p{font-size:.8rem;color:var(--text-muted)}
.social-links{display:flex;gap:16px}
.social-links a{color:var(--text-muted);text-decoration:none;font-size:.85rem;transition:color .2s}
.social-links a:hover{color:var(--primary)}
@media(max-width:768px){.nav-links{display:none}.hero-actions{flex-direction:column}.about-grid{grid-template-columns:1fr}.about-stats{flex-direction:row}.form-row{grid-template-columns:1fr}.footer-inner{flex-direction:column;gap:16px;text-align:center}}`
    },
  },
  {
    id: "ecommerce-starter",
    name: "E-Commerce Starter",
    description: "A product showcase with shopping cart, category filters, and localStorage-based cart persistence. Ready for integration with any payment API.",
    category: "ecommerce",
    platforms: ["replit", "lovable", "any"],
    tags: ["shop", "store", "products", "cart"],
    thumbnail: "linear-gradient(135deg, #1a1a2e 0%, #422006 50%, #f59e0b 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 3,
    downloadCount: 0,
    createdAt: "2026-02-20T00:00:00Z",
    featured: false,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shop</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="#" class="logo">The<span>Shop</span></a><div class="nav-right"><button class="cart-btn" onclick="toggleCart()">Cart (<span id="cart-count">0</span>)</button></div></div></nav>
<div class="layout">
<aside class="sidebar"><h3>Categories</h3><button class="filter-btn active" onclick="filterCategory('all',this)">All Products</button><button class="filter-btn" onclick="filterCategory('clothing',this)">Clothing</button><button class="filter-btn" onclick="filterCategory('electronics',this)">Electronics</button><button class="filter-btn" onclick="filterCategory('accessories',this)">Accessories</button><h3 class="mt">Price Range</h3><input type="range" min="0" max="200" value="200" id="price-range" oninput="filterPrice(this.value)"><p class="price-label">Up to $<span id="price-val">200</span></p></aside>
<main class="main"><div class="products-header"><h1>All Products</h1><p id="product-count">12 products</p></div><div class="product-grid" id="product-grid"></div></main>
</div>
<div class="cart-overlay" id="cart-overlay" onclick="toggleCart()"></div>
<div class="cart-drawer" id="cart-drawer"><div class="cart-header"><h2>Shopping Cart</h2><button onclick="toggleCart()">&times;</button></div><div id="cart-items"></div><div class="cart-footer"><div class="cart-total">Total: $<span id="cart-total">0.00</span></div><button class="btn btn-checkout">Checkout</button></div></div>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#f59e0b;--primary-dark:#d97706;--bg:#fafaf9;--card:#fff;--text:#1c1917;--text-muted:#78716c;--border:#e7e5e4;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.nav{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid var(--border);height:60px}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:100%}
.logo{font-size:1.25rem;font-weight:700;text-decoration:none;color:var(--text)}.logo span{color:var(--primary)}
.cart-btn{background:var(--primary);color:#fff;border:none;padding:8px 20px;border-radius:var(--radius);font-weight:600;cursor:pointer;font-size:.875rem}
.cart-btn:hover{background:var(--primary-dark)}
.layout{display:flex;max-width:1200px;margin:0 auto;padding:24px;gap:24px}
.sidebar{width:240px;flex-shrink:0}
.sidebar h3{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:12px}.mt{margin-top:24px}
.filter-btn{display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;font-size:.9rem;cursor:pointer;border-radius:6px;margin-bottom:4px;color:var(--text-muted);transition:all .2s}
.filter-btn:hover,.filter-btn.active{background:var(--primary);color:#fff}
input[type=range]{width:100%;accent-color:var(--primary)}
.price-label{font-size:.85rem;color:var(--text-muted);margin-top:4px}
.main{flex:1}
.products-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px}
.products-header h1{font-size:1.5rem}
.products-header p{font-size:.85rem;color:var(--text-muted)}
.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
.product-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.product-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.product-thumb{height:180px;display:flex;align-items:center;justify-content:center;font-size:3rem}
.product-info{padding:16px}
.product-info h3{font-size:.95rem;margin-bottom:4px}
.product-info .cat{font-size:.75rem;color:var(--text-muted);margin-bottom:8px}
.product-info .price{font-size:1.1rem;font-weight:700;color:var(--primary)}
.product-info .add-btn{display:block;width:100%;margin-top:12px;padding:8px;border:none;background:var(--text);color:#fff;border-radius:6px;font-weight:600;cursor:pointer;font-size:.85rem;transition:background .2s}
.product-info .add-btn:hover{background:var(--primary)}
.cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:90;display:none}
.cart-overlay.open{display:block}
.cart-drawer{position:fixed;top:0;right:-400px;width:380px;height:100vh;background:#fff;z-index:100;box-shadow:-4px 0 24px rgba(0,0,0,.1);transition:right .3s;display:flex;flex-direction:column}
.cart-drawer.open{right:0}
.cart-header{display:flex;align-items:center;justify-content:space-between;padding:20px;border-bottom:1px solid var(--border)}
.cart-header button{background:none;border:none;font-size:1.5rem;cursor:pointer}
#cart-items{flex:1;overflow-y:auto;padding:16px}
.cart-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}
.cart-item-info{flex:1}
.cart-item-info h4{font-size:.9rem}
.cart-item-info p{font-size:.8rem;color:var(--text-muted)}
.cart-item button{background:none;border:none;color:red;cursor:pointer;font-size:.8rem}
.cart-footer{padding:20px;border-top:1px solid var(--border)}
.cart-total{font-size:1.2rem;font-weight:700;margin-bottom:12px}
.btn-checkout{width:100%;padding:12px;border:none;background:var(--primary);color:#fff;font-size:1rem;font-weight:600;border-radius:var(--radius);cursor:pointer}
.btn-checkout:hover{background:var(--primary-dark)}
@media(max-width:768px){.layout{flex-direction:column}.sidebar{width:100%}.product-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.cart-drawer{width:100%}}`,
      "app.js": `const PRODUCTS=[
{id:1,name:"Classic T-Shirt",category:"clothing",price:29.99,color:"#e7e5e4",emoji:"\\u{1F455}"},
{id:2,name:"Wireless Earbuds",category:"electronics",price:79.99,color:"#dbeafe",emoji:"\\u{1F3A7}"},
{id:3,name:"Leather Wallet",category:"accessories",price:49.99,color:"#fef3c7",emoji:"\\u{1F45B}"},
{id:4,name:"Running Shoes",category:"clothing",price:119.99,color:"#dcfce7",emoji:"\\u{1F45F}"},
{id:5,name:"Smart Watch",category:"electronics",price:199.99,color:"#e0e7ff",emoji:"\\u231A"},
{id:6,name:"Sunglasses",category:"accessories",price:39.99,color:"#fce7f3",emoji:"\\u{1F576}"},
{id:7,name:"Denim Jacket",category:"clothing",price:89.99,color:"#dbeafe",emoji:"\\u{1F9E5}"},
{id:8,name:"Bluetooth Speaker",category:"electronics",price:59.99,color:"#f3e8ff",emoji:"\\u{1F50A}"},
{id:9,name:"Canvas Backpack",category:"accessories",price:64.99,color:"#fef9c3",emoji:"\\u{1F392}"},
{id:10,name:"Hoodie",category:"clothing",price:54.99,color:"#e7e5e4",emoji:"\\u{1F9E3}"},
{id:11,name:"USB-C Hub",category:"electronics",price:34.99,color:"#f1f5f9",emoji:"\\u{1F50C}"},
{id:12,name:"Beanie Hat",category:"accessories",price:19.99,color:"#fef3c7",emoji:"\\u{1F9E2}"}
];
let cart=JSON.parse(localStorage.getItem("cart")||"[]");
let currentCategory="all";
let maxPrice=200;
function renderProducts(){
  const grid=document.getElementById("product-grid");
  const filtered=PRODUCTS.filter(p=>(currentCategory==="all"||p.category===currentCategory)&&p.price<=maxPrice);
  document.getElementById("product-count").textContent=filtered.length+" products";
  grid.innerHTML=filtered.map(p=>\`<div class="product-card"><div class="product-thumb" style="background:\${p.color}">\${p.emoji}</div><div class="product-info"><h3>\${p.name}</h3><p class="cat">\${p.category}</p><p class="price">$\${p.price.toFixed(2)}</p><button class="add-btn" onclick="addToCart(\${p.id})">Add to Cart</button></div></div>\`).join("");
}
function filterCategory(cat,btn){
  currentCategory=cat;
  document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  renderProducts();
}
function filterPrice(val){maxPrice=parseInt(val);document.getElementById("price-val").textContent=val;renderProducts()}
function addToCart(id){
  const p=PRODUCTS.find(x=>x.id===id);if(!p)return;
  const existing=cart.find(x=>x.id===id);
  if(existing)existing.qty++;else cart.push({...p,qty:1});
  saveCart();renderCart();
}
function removeFromCart(id){cart=cart.filter(x=>x.id!==id);saveCart();renderCart()}
function saveCart(){localStorage.setItem("cart",JSON.stringify(cart))}
function renderCart(){
  document.getElementById("cart-count").textContent=cart.reduce((s,i)=>s+i.qty,0);
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);
  document.getElementById("cart-total").textContent=total.toFixed(2);
  document.getElementById("cart-items").innerHTML=cart.length===0?"<p style='text-align:center;padding:40px;color:#78716c'>Your cart is empty</p>":cart.map(i=>\`<div class="cart-item"><span style="font-size:1.5rem">\${i.emoji}</span><div class="cart-item-info"><h4>\${i.name}</h4><p>$\${i.price.toFixed(2)} x \${i.qty}</p></div><button onclick="removeFromCart(\${i.id})">Remove</button></div>\`).join("");
}
function toggleCart(){
  document.getElementById("cart-drawer").classList.toggle("open");
  document.getElementById("cart-overlay").classList.toggle("open");
}
renderProducts();renderCart();`
    },
  },
  {
    id: "blog-template",
    name: "Blog Template",
    description: "A clean, readable blog with article listing, category sidebar, and individual post pages. Typography-focused design optimized for long-form content.",
    category: "blog",
    platforms: ["replit", "lovable", "vercel", "netlify", "any"],
    tags: ["blog", "content", "articles", "minimal"],
    thumbnail: "linear-gradient(135deg, #1c1917 0%, #292524 50%, #dc2626 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 3,
    downloadCount: 0,
    createdAt: "2026-02-22T00:00:00Z",
    featured: false,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Blog</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="index.html" class="logo">The<span>Blog</span></a><div class="nav-links"><a href="index.html" class="active">Home</a><a href="#">Archive</a><a href="#">About</a></div></div></nav>
<div class="layout container">
<main class="main">
<article class="post-preview featured"><span class="post-badge">Featured</span><h2><a href="post.html">The Future of Web Development in 2026</a></h2><p class="post-meta">March 1, 2026 &middot; 8 min read &middot; <span class="cat-tag">Technology</span></p><p>Exploring how AI, edge computing, and new frameworks are reshaping the way we build for the web. From server components to AI-assisted coding, the landscape is evolving rapidly...</p><a href="post.html" class="read-more">Read More &rarr;</a></article>
<article class="post-preview"><h2><a href="post.html">Getting Started with TypeScript in 2026</a></h2><p class="post-meta">Feb 25, 2026 &middot; 5 min read &middot; <span class="cat-tag">Tutorial</span></p><p>A beginner-friendly guide to TypeScript, covering setup, basic types, interfaces, and best practices for modern projects...</p><a href="post.html" class="read-more">Read More &rarr;</a></article>
<article class="post-preview"><h2><a href="post.html">Design Systems That Actually Scale</a></h2><p class="post-meta">Feb 20, 2026 &middot; 6 min read &middot; <span class="cat-tag">Design</span></p><p>Lessons learned from building and maintaining design systems at scale. Tokens, components, documentation, and organizational buy-in...</p><a href="post.html" class="read-more">Read More &rarr;</a></article>
<article class="post-preview"><h2><a href="post.html">Why I Switched to Bun</a></h2><p class="post-meta">Feb 15, 2026 &middot; 4 min read &middot; <span class="cat-tag">Opinion</span></p><p>After years with Node.js, I gave Bun a serious try. Here's what convinced me to switch my development workflow...</p><a href="post.html" class="read-more">Read More &rarr;</a></article>
</main>
<aside class="aside"><div class="widget"><h3>Categories</h3><ul><li><a href="#">Technology <span>(8)</span></a></li><li><a href="#">Tutorial <span>(12)</span></a></li><li><a href="#">Design <span>(5)</span></a></li><li><a href="#">Opinion <span>(7)</span></a></li></ul></div><div class="widget"><h3>Newsletter</h3><p>Get weekly articles delivered to your inbox.</p><form class="newsletter-form"><input type="email" placeholder="your@email.com"><button type="submit">Subscribe</button></form></div></aside>
</div>
<footer class="footer"><div class="container footer-inner"><p>&copy; 2026 The Blog. Built with care.</p></div></footer>
</body>
</html>`,
      "post.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Future of Web Development - The Blog</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="index.html" class="logo">The<span>Blog</span></a><div class="nav-links"><a href="index.html">Home</a><a href="#">Archive</a><a href="#">About</a></div></div></nav>
<article class="article container">
<header class="article-header"><span class="cat-tag">Technology</span><h1>The Future of Web Development in 2026</h1><p class="post-meta">March 1, 2026 &middot; 8 min read</p></header>
<div class="article-body">
<p>The web development landscape continues to evolve at a breathtaking pace. As we navigate through 2026, several trends have solidified their position as the new standards of how we build for the web.</p>
<h2>AI-Assisted Development</h2>
<p>AI coding assistants have moved beyond simple autocomplete. Modern tools can now understand entire codebases, suggest architectural improvements, and even write comprehensive test suites. The key shift is from AI as a typing accelerator to AI as a thinking partner.</p>
<h2>Edge-First Architecture</h2>
<p>The edge computing paradigm has fundamentally changed how we think about deployment. With compute available at hundreds of points of presence worldwide, the traditional client-server model is giving way to distributed architectures that place logic closer to users.</p>
<h2>The Component Renaissance</h2>
<p>Web Components have finally hit their stride. With better tooling, improved SSR support, and framework-agnostic design systems, the dream of truly portable components is becoming reality. Major design systems are now shipping framework-agnostic component libraries.</p>
<blockquote>The best code is the code you don't have to write. The second best is the code that writes itself.</blockquote>
<h2>What's Next</h2>
<p>Looking ahead, the convergence of AI, edge computing, and improved web standards promises an even more exciting future. The tools are getting better, the platforms are getting faster, and the possibilities are expanding.</p>
</div>
</article>
<footer class="footer"><div class="container footer-inner"><p>&copy; 2026 The Blog. Built with care.</p></div></footer>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#dc2626;--bg:#fafaf9;--card:#fff;--text:#1c1917;--text-muted:#78716c;--border:#e7e5e4;--radius:8px}
body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--text);line-height:1.8}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{background:#fff;border-bottom:1px solid var(--border);height:60px;position:sticky;top:0;z-index:50}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:100%}
.logo{font-size:1.25rem;font-weight:700;text-decoration:none;color:var(--text);font-family:-apple-system,sans-serif}.logo span{color:var(--primary)}
.nav-links{display:flex;gap:20px}.nav-links a{color:var(--text-muted);text-decoration:none;font-family:-apple-system,sans-serif;font-size:.875rem;transition:color .2s}.nav-links a:hover,.nav-links a.active{color:var(--primary)}
.layout{display:grid;grid-template-columns:1fr 300px;gap:48px;padding:40px 24px}
.post-preview{padding:32px 0;border-bottom:1px solid var(--border);position:relative}
.post-preview.featured{background:linear-gradient(135deg,rgba(220,38,38,.03),transparent);padding:32px;border:1px solid var(--border);border-radius:12px;margin-bottom:24px}
.post-badge{font-family:-apple-system,sans-serif;font-size:.7rem;background:var(--primary);color:#fff;padding:3px 10px;border-radius:20px;font-weight:600;text-transform:uppercase}
.post-preview h2{font-size:1.5rem;margin:12px 0 8px;line-height:1.3}
.post-preview h2 a{color:var(--text);text-decoration:none;transition:color .2s}.post-preview h2 a:hover{color:var(--primary)}
.post-meta{font-family:-apple-system,sans-serif;font-size:.8rem;color:var(--text-muted);margin-bottom:12px}
.cat-tag{background:rgba(220,38,38,.1);color:var(--primary);padding:2px 8px;border-radius:4px;font-size:.75rem}
.post-preview p{color:var(--text-muted);font-size:.95rem}
.read-more{display:inline-block;margin-top:12px;color:var(--primary);text-decoration:none;font-family:-apple-system,sans-serif;font-size:.85rem;font-weight:600}
.aside{position:sticky;top:80px;align-self:start}
.widget{background:#fff;border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px}
.widget h3{font-family:-apple-system,sans-serif;font-size:.9rem;margin-bottom:16px}
.widget ul{list-style:none}
.widget ul li{padding:8px 0;border-bottom:1px solid var(--border)}
.widget ul li a{color:var(--text);text-decoration:none;font-family:-apple-system,sans-serif;font-size:.875rem;display:flex;justify-content:space-between}
.widget ul li a span{color:var(--text-muted)}
.widget p{font-size:.85rem;color:var(--text-muted);margin-bottom:12px;font-family:-apple-system,sans-serif}
.newsletter-form{display:flex;gap:8px}
.newsletter-form input{flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:.85rem}
.newsletter-form button{padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer}
.article{max-width:720px;margin:0 auto;padding:40px 24px 80px}
.article-header{margin-bottom:40px;text-align:center}
.article-header h1{font-size:2.2rem;margin:16px 0 12px;line-height:1.2}
.article-body h2{font-size:1.4rem;margin:32px 0 16px;font-family:-apple-system,sans-serif}
.article-body p{margin-bottom:20px;font-size:1.05rem;color:#44403c}
.article-body blockquote{border-left:3px solid var(--primary);margin:24px 0;padding:16px 24px;font-style:italic;color:var(--text-muted);background:rgba(220,38,38,.03);border-radius:0 8px 8px 0}
.footer{padding:24px 0;border-top:1px solid var(--border)}.footer-inner{text-align:center}.footer p{font-size:.8rem;color:var(--text-muted);font-family:-apple-system,sans-serif}
@media(max-width:768px){.layout{grid-template-columns:1fr}.aside{position:static}}`
    },
  },
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    description: "A data-rich admin panel with stats cards, data tables, sidebar navigation, and canvas-based charts. Includes sample data and responsive layout.",
    category: "dashboard",
    platforms: ["replit", "lovable", "any"],
    tags: ["admin", "dashboard", "analytics", "management"],
    thumbnail: "linear-gradient(135deg, #0f172a 0%, #0e4429 50%, #22d3ee 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 3,
    downloadCount: 0,
    createdAt: "2026-02-24T00:00:00Z",
    featured: true,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Dashboard</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div class="app">
<aside class="sidebar"><div class="sidebar-header"><span class="sidebar-logo">&#9670; Admin</span></div><nav class="sidebar-nav"><a href="#" class="nav-item active"><span class="nav-icon">&#9632;</span> Dashboard</a><a href="#" class="nav-item"><span class="nav-icon">&#9782;</span> Analytics</a><a href="#" class="nav-item"><span class="nav-icon">&#9998;</span> Users</a><a href="#" class="nav-item"><span class="nav-icon">&#9881;</span> Settings</a></nav></aside>
<main class="content">
<header class="topbar"><h1>Dashboard</h1><div class="topbar-right"><input type="text" placeholder="Search..." class="search-input"><div class="avatar">A</div></div></header>
<div class="stats-grid"><div class="stat-card"><p class="stat-label">Total Revenue</p><p class="stat-value">$48,290</p><p class="stat-change positive">+12.5%</p></div><div class="stat-card"><p class="stat-label">Active Users</p><p class="stat-value">2,847</p><p class="stat-change positive">+8.2%</p></div><div class="stat-card"><p class="stat-label">Conversion Rate</p><p class="stat-value">3.24%</p><p class="stat-change negative">-1.1%</p></div><div class="stat-card"><p class="stat-label">Avg. Order Value</p><p class="stat-value">$67.40</p><p class="stat-change positive">+4.8%</p></div></div>
<div class="charts-grid"><div class="chart-card"><h3>Revenue Overview</h3><canvas id="chart-revenue" height="200"></canvas></div><div class="chart-card"><h3>Traffic Sources</h3><canvas id="chart-traffic" height="200"></canvas></div></div>
<div class="table-card"><div class="table-header"><h3>Recent Orders</h3><button class="btn-sm">Export</button></div><table><thead><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th></tr></thead><tbody><tr><td>#ORD-001</td><td>Alice Johnson</td><td>Pro Plan</td><td>$99.00</td><td><span class="badge badge-success">Completed</span></td></tr><tr><td>#ORD-002</td><td>Bob Smith</td><td>Enterprise</td><td>$299.00</td><td><span class="badge badge-warning">Pending</span></td></tr><tr><td>#ORD-003</td><td>Carol White</td><td>Starter</td><td>$29.00</td><td><span class="badge badge-success">Completed</span></td></tr><tr><td>#ORD-004</td><td>David Brown</td><td>Pro Plan</td><td>$99.00</td><td><span class="badge badge-error">Failed</span></td></tr><tr><td>#ORD-005</td><td>Eve Davis</td><td>Enterprise</td><td>$299.00</td><td><span class="badge badge-success">Completed</span></td></tr></tbody></table></div>
</main>
</div>
<script src="dashboard.js"></script>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#22d3ee;--bg:#0f172a;--sidebar:#1e293b;--card:#1e293b;--text:#e2e8f0;--text-muted:#94a3b8;--border:#334155;--success:#22c55e;--warning:#f59e0b;--error:#ef4444}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
.app{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;bottom:0}
.sidebar-header{padding:20px;border-bottom:1px solid var(--border)}
.sidebar-logo{font-size:1.1rem;font-weight:700;color:var(--primary)}
.sidebar-nav{padding:12px;display:flex;flex-direction:column;gap:4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;color:var(--text-muted);text-decoration:none;font-size:.875rem;transition:all .2s}
.nav-item:hover{background:rgba(255,255,255,.05);color:var(--text)}
.nav-item.active{background:rgba(34,211,238,.1);color:var(--primary)}
.nav-icon{font-size:1rem}
.content{flex:1;margin-left:240px;padding:24px}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.topbar h1{font-size:1.5rem;font-weight:700}
.topbar-right{display:flex;align-items:center;gap:16px}
.search-input{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem;width:200px}
.search-input:focus{outline:none;border-color:var(--primary)}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--primary);color:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
.stat-label{font-size:.8rem;color:var(--text-muted);margin-bottom:4px}
.stat-value{font-size:1.75rem;font-weight:700}
.stat-change{font-size:.8rem;margin-top:4px}
.stat-change.positive{color:var(--success)}
.stat-change.negative{color:var(--error)}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
.chart-card h3{font-size:.9rem;margin-bottom:16px}
.table-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.table-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.table-header h3{font-size:.9rem}
.btn-sm{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.8rem;cursor:pointer;transition:all .2s}
.btn-sm:hover{border-color:var(--primary);color:var(--primary)}
table{width:100%;border-collapse:collapse}
th,td{padding:12px 20px;text-align:left;font-size:.85rem;border-bottom:1px solid var(--border)}
th{color:var(--text-muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
.badge{font-size:.75rem;padding:3px 10px;border-radius:20px;font-weight:600}
.badge-success{background:rgba(34,197,94,.15);color:var(--success)}
.badge-warning{background:rgba(245,158,11,.15);color:var(--warning)}
.badge-error{background:rgba(239,68,68,.15);color:var(--error)}
@media(max-width:1024px){.stats-grid{grid-template-columns:repeat(2,1fr)}.charts-grid{grid-template-columns:1fr}}
@media(max-width:768px){.sidebar{display:none}.content{margin-left:0}.stats-grid{grid-template-columns:1fr}}`,
      "dashboard.js": `function drawBarChart(id,labels,data,color){
  const canvas=document.getElementById(id);if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const w=canvas.width=canvas.parentElement.clientWidth-40;
  const h=canvas.height=200;
  const max=Math.max(...data)*1.2;
  const barW=w/labels.length*.6;
  const gap=w/labels.length*.4;
  ctx.clearRect(0,0,w,h);
  // grid lines
  for(let i=0;i<5;i++){
    const y=h-20-(h-40)*i/4;
    ctx.strokeStyle="#334155";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(w,y);ctx.stroke();
    ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";
    ctx.fillText("$"+Math.round(max*i/4/1000)+"k",0,y+4);
  }
  // bars
  data.forEach((v,i)=>{
    const x=50+i*(barW+gap);
    const barH=(h-40)*v/max;
    const y=h-20-barH;
    const gradient=ctx.createLinearGradient(x,y,x,h-20);
    gradient.addColorStop(0,color);gradient.addColorStop(1,color+"40");
    ctx.fillStyle=gradient;
    ctx.beginPath();ctx.roundRect(x,y,barW,barH,[4,4,0,0]);ctx.fill();
    ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";ctx.textAlign="center";
    ctx.fillText(labels[i],x+barW/2,h-4);
  });
}
function drawDonut(id,labels,data,colors){
  const canvas=document.getElementById(id);if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const w=canvas.width=canvas.parentElement.clientWidth-40;
  const h=canvas.height=200;
  const cx=w/2-60;const cy=h/2;const r=70;const inner=45;
  const total=data.reduce((a,b)=>a+b,0);
  let angle=-Math.PI/2;
  ctx.clearRect(0,0,w,h);
  data.forEach((v,i)=>{
    const slice=2*Math.PI*v/total;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.fillStyle=colors[i];ctx.fill();
    angle+=slice;
  });
  ctx.beginPath();ctx.arc(cx,cy,inner,0,2*Math.PI);ctx.fillStyle="#1e293b";ctx.fill();
  ctx.fillStyle="#e2e8f0";ctx.font="bold 18px sans-serif";ctx.textAlign="center";
  ctx.fillText(total.toLocaleString(),cx,cy+6);
  // legend
  const lx=w/2+20;
  labels.forEach((l,i)=>{
    const ly=30+i*28;
    ctx.fillStyle=colors[i];ctx.fillRect(lx,ly,12,12);
    ctx.fillStyle="#e2e8f0";ctx.font="12px sans-serif";ctx.textAlign="left";
    ctx.fillText(l+" ("+data[i]+")",lx+20,ly+10);
  });
}
drawBarChart("chart-revenue",["Jan","Feb","Mar","Apr","May","Jun"],[12400,15800,13200,18500,21000,19300],"#22d3ee");
drawDonut("chart-traffic",["Direct","Organic","Referral","Social"],[420,310,180,90],["#22d3ee","#8b5cf6","#f59e0b","#22c55e"]);`
    },
  },
  {
    id: "restaurant-website",
    name: "Restaurant Website",
    description: "An appetizing restaurant website with menu sections, image gallery placeholders, reservation form, hours, and location info. Warm, inviting design.",
    category: "landing-page",
    platforms: ["replit", "lovable", "vercel", "netlify", "any"],
    tags: ["restaurant", "food", "menu", "business", "local"],
    thumbnail: "linear-gradient(135deg, #1c1917 0%, #7c2d12 50%, #ea580c 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 2,
    downloadCount: 0,
    createdAt: "2026-02-26T00:00:00Z",
    featured: false,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>La Tavola</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="#" class="logo">La Tavola</a><div class="nav-links"><a href="#menu">Menu</a><a href="#about">About</a><a href="#reserve">Reservations</a><a href="#contact">Contact</a></div></div></nav>
<header class="hero"><div class="hero-overlay"></div><div class="container hero-content"><p class="hero-tag">Italian Cuisine</p><h1>Where Every Meal<br>Tells a Story</h1><p class="hero-sub">Handcrafted pasta, wood-fired pizzas, and timeless Italian recipes made with locally sourced ingredients.</p><a href="#reserve" class="btn">Reserve a Table</a></div></header>
<section id="menu" class="section"><div class="container"><h2>Our Menu</h2><p class="section-sub">Fresh, seasonal ingredients prepared with traditional techniques</p><div class="menu-grid"><div class="menu-category"><h3>Antipasti</h3><div class="menu-item"><div class="menu-item-info"><h4>Bruschetta Classica</h4><p>Toasted sourdough, heirloom tomatoes, fresh basil, extra virgin olive oil</p></div><span class="menu-price">$14</span></div><div class="menu-item"><div class="menu-item-info"><h4>Burrata</h4><p>Creamy burrata, roasted peppers, arugula, balsamic reduction</p></div><span class="menu-price">$18</span></div><div class="menu-item"><div class="menu-item-info"><h4>Calamari Fritti</h4><p>Lightly fried calamari, marinara, lemon aioli</p></div><span class="menu-price">$16</span></div></div><div class="menu-category"><h3>Primi</h3><div class="menu-item"><div class="menu-item-info"><h4>Cacio e Pepe</h4><p>House-made tonnarelli, Pecorino Romano, black pepper</p></div><span class="menu-price">$22</span></div><div class="menu-item"><div class="menu-item-info"><h4>Pappardelle Bolognese</h4><p>Wide ribbon pasta, slow-braised beef and pork ragu</p></div><span class="menu-price">$26</span></div><div class="menu-item"><div class="menu-item-info"><h4>Risotto ai Funghi</h4><p>Arborio rice, wild mushrooms, truffle oil, Parmigiano</p></div><span class="menu-price">$24</span></div></div></div></div></section>
<section id="about" class="section section-alt"><div class="container about-layout"><div class="about-img"><div class="img-placeholder">&#127858;</div></div><div class="about-text"><h2>Our Story</h2><p>Founded in 2018, La Tavola brings the warmth of Italian family dining to the heart of the city. Our chef trained in Bologna and brings decades of tradition to every dish.</p><p>We believe in simplicity, quality ingredients, and the power of a shared meal to bring people together.</p><div class="hours"><h4>Hours</h4><p>Tue - Thu: 5:00 PM - 10:00 PM</p><p>Fri - Sat: 5:00 PM - 11:00 PM</p><p>Sun: 4:00 PM - 9:00 PM</p><p>Mon: Closed</p></div></div></div></section>
<section id="reserve" class="section"><div class="container"><h2>Reserve a Table</h2><p class="section-sub">Book your experience with us</p><form class="reserve-form"><div class="form-row"><div class="form-group"><label>Name</label><input type="text" placeholder="Your name"></div><div class="form-group"><label>Email</label><input type="email" placeholder="your@email.com"></div></div><div class="form-row"><div class="form-group"><label>Date</label><input type="date"></div><div class="form-group"><label>Time</label><select><option>5:00 PM</option><option>6:00 PM</option><option>7:00 PM</option><option>8:00 PM</option><option>9:00 PM</option></select></div><div class="form-group"><label>Guests</label><select><option>2</option><option>3</option><option>4</option><option>5</option><option>6+</option></select></div></div><div class="form-group"><label>Special Requests</label><textarea rows="3" placeholder="Allergies, celebrations, seating preferences..."></textarea></div><button type="submit" class="btn btn-full">Reserve Now</button></form></div></section>
<section id="contact" class="section section-alt"><div class="container contact-grid"><div><h2>Visit Us</h2><p>123 Main Street<br>Downtown, NY 10001</p><p class="mt">Phone: (555) 123-4567<br>Email: hello@latavola.com</p></div><div class="map-placeholder"><span>&#127759; Map</span></div></div></section>
<footer class="footer"><div class="container footer-inner"><p>&copy; 2026 La Tavola. All rights reserved.</p></div></footer>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#ea580c;--primary-dark:#c2410c;--bg:#fffbeb;--bg-alt:#fef3c7;--card:#fff;--text:#1c1917;--text-muted:#78716c;--border:#e7e5e4;--radius:8px}
body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--text);line-height:1.7}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(12px);background:rgba(255,251,235,.9);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-size:1.4rem;font-weight:700;text-decoration:none;color:var(--primary);font-style:italic}
.nav-links{display:flex;gap:24px}.nav-links a{color:var(--text-muted);text-decoration:none;font-family:-apple-system,sans-serif;font-size:.875rem;transition:color .2s}.nav-links a:hover{color:var(--primary)}
.hero{position:relative;min-height:80vh;display:flex;align-items:center;background:linear-gradient(135deg,#1c1917,#44403c);overflow:hidden}
.hero-overlay{position:absolute;inset:0;background:rgba(0,0,0,.4)}
.hero-content{position:relative;z-index:1;color:#fff;max-width:600px}
.hero-tag{font-family:-apple-system,sans-serif;font-size:.85rem;color:var(--primary);text-transform:uppercase;letter-spacing:.15em;margin-bottom:12px}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.15;margin-bottom:20px}
.hero-sub{font-size:1.1rem;color:rgba(255,255,255,.8);margin-bottom:28px}
.btn{display:inline-flex;padding:14px 32px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius);font-weight:600;font-size:.9rem;font-family:-apple-system,sans-serif;text-decoration:none;cursor:pointer;transition:all .2s}
.btn:hover{background:var(--primary-dark);transform:translateY(-1px)}
.btn-full{width:100%;justify-content:center}
.section{padding:80px 0}.section-alt{background:var(--bg-alt)}
.section h2{font-size:2rem;text-align:center;margin-bottom:8px}
.section-sub{text-align:center;color:var(--text-muted);margin-bottom:48px;font-family:-apple-system,sans-serif;font-size:.9rem}
.menu-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px}
.menu-category h3{font-size:1.2rem;color:var(--primary);margin-bottom:20px;padding-bottom:8px;border-bottom:2px solid var(--primary)}
.menu-item{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 0;border-bottom:1px dashed var(--border)}
.menu-item-info h4{font-size:1rem;margin-bottom:4px;font-family:-apple-system,sans-serif}
.menu-item-info p{font-size:.85rem;color:var(--text-muted);font-family:-apple-system,sans-serif}
.menu-price{font-size:1.1rem;font-weight:700;color:var(--primary);font-family:-apple-system,sans-serif;white-space:nowrap;margin-left:16px}
.about-layout{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.about-text h2{text-align:left;margin-bottom:16px}
.about-text p{color:var(--text-muted);margin-bottom:16px;font-size:.95rem}
.hours{margin-top:24px;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:12px}
.hours h4{font-family:-apple-system,sans-serif;font-size:.9rem;margin-bottom:8px}
.hours p{font-size:.85rem;color:var(--text-muted);font-family:-apple-system,sans-serif;margin-bottom:2px}
.img-placeholder{height:400px;background:linear-gradient(135deg,#fef3c7,#fed7aa);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:5rem}
.reserve-form{max-width:640px;margin:0 auto}
.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-family:-apple-system,sans-serif;font-size:.8rem;font-weight:600;margin-bottom:6px;color:var(--text-muted)}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:.9rem;font-family:inherit;background:#fff;color:var(--text)}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:var(--primary)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.contact-grid h2{text-align:left;margin-bottom:16px}
.contact-grid p{color:var(--text-muted);font-family:-apple-system,sans-serif;font-size:.9rem}.mt{margin-top:16px}
.map-placeholder{height:300px;background:#e7e5e4;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-muted)}
.footer{padding:24px 0;border-top:1px solid var(--border)}.footer-inner{text-align:center}.footer p{font-size:.8rem;color:var(--text-muted);font-family:-apple-system,sans-serif}
@media(max-width:768px){.nav-links{display:none}.menu-grid{grid-template-columns:1fr}.about-layout{grid-template-columns:1fr}.contact-grid{grid-template-columns:1fr}}`
    },
  },
  {
    id: "react-saas-dashboard",
    name: "React SaaS Dashboard",
    description: "A complete React + Vite SaaS dashboard with sidebar navigation, metrics cards, and modern component architecture. Ready to extend with your own features.",
    category: "saas",
    platforms: ["replit", "lovable", "vercel"],
    tags: ["react", "saas", "dashboard", "vite", "modern"],
    thumbnail: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #7c3aed 80%, #a78bfa 100%)",
    framework: "react",
    version: "1.0.0",
    fileCount: 6,
    downloadCount: 0,
    createdAt: "2026-02-28T00:00:00Z",
    featured: true,
    files: {
      "package.json": `{
  "name": "saas-dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}`,
      "vite.config.js": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SaaS Dashboard</title></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
      "src/main.jsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`,
      "src/App.jsx": `import { useState } from 'react'

const METRICS = [
  { label: 'Total Revenue', value: '$48,290', change: '+12.5%', positive: true },
  { label: 'Active Users', value: '2,847', change: '+8.2%', positive: true },
  { label: 'Conversion', value: '3.24%', change: '-1.1%', positive: false },
  { label: 'Avg Order', value: '$67.40', change: '+4.8%', positive: true },
]

const NAV_ITEMS = [
  { icon: '\\u25A0', label: 'Dashboard', id: 'dashboard' },
  { icon: '\\u2603', label: 'Analytics', id: 'analytics' },
  { icon: '\\u263A', label: 'Users', id: 'users' },
  { icon: '\\u2699', label: 'Settings', id: 'settings' },
]

const ORDERS = [
  { id: '#ORD-001', customer: 'Alice Johnson', product: 'Pro Plan', amount: '$99.00', status: 'Completed' },
  { id: '#ORD-002', customer: 'Bob Smith', product: 'Enterprise', amount: '$299.00', status: 'Pending' },
  { id: '#ORD-003', customer: 'Carol White', product: 'Starter', amount: '$29.00', status: 'Completed' },
  { id: '#ORD-004', customer: 'David Brown', product: 'Pro Plan', amount: '$99.00', status: 'Failed' },
  { id: '#ORD-005', customer: 'Eve Davis', product: 'Enterprise', amount: '$299.00', status: 'Completed' },
]

function MetricCard({ metric }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{metric.label}</p>
      <p className="metric-value">{metric.value}</p>
      <p className={\`metric-change \${metric.positive ? 'positive' : 'negative'}\`}>{metric.change}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const cls = status === 'Completed' ? 'badge-success' : status === 'Pending' ? 'badge-warning' : 'badge-error'
  return <span className={\`badge \${cls}\`}>{status}</span>
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">\\u25C6 SaaS App</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={\`nav-btn \${activePage === item.id ? 'active' : ''}\`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <h1>Dashboard</h1>
          <div className="topbar-right">
            <input type="text" placeholder="Search..." className="search-box" />
            <div className="user-avatar">U</div>
          </div>
        </header>
        <div className="metrics-grid">
          {METRICS.map((m, i) => <MetricCard key={i} metric={m} />)}
        </div>
        <div className="table-section">
          <div className="table-header">
            <h2>Recent Orders</h2>
            <button className="btn-outline">Export</button>
          </div>
          <table>
            <thead><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {ORDERS.map(o => (
                <tr key={o.id}><td>{o.id}</td><td>{o.customer}</td><td>{o.product}</td><td>{o.amount}</td><td><StatusBadge status={o.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}`,
      "src/App.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#7c3aed;--bg:#0f172a;--sidebar:#1e293b;--card:#1e293b;--text:#e2e8f0;--text-muted:#94a3b8;--border:#334155;--success:#22c55e;--warning:#f59e0b;--error:#ef4444}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
.app-layout{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--sidebar);border-right:1px solid var(--border);padding:20px 12px;position:fixed;top:0;bottom:0}
.sidebar-brand{font-size:1.1rem;font-weight:700;color:var(--primary);padding:0 8px 20px;border-bottom:1px solid var(--border);margin-bottom:12px}
.sidebar-nav{display:flex;flex-direction:column;gap:4px}
.nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:none;border-radius:8px;background:transparent;color:var(--text-muted);font-size:.875rem;cursor:pointer;transition:all .15s;text-align:left}
.nav-btn:hover{background:rgba(255,255,255,.05);color:var(--text)}
.nav-btn.active{background:rgba(124,58,237,.15);color:var(--primary)}
.nav-icon{font-size:1rem;width:20px;text-align:center}
.main-content{flex:1;margin-left:240px;padding:24px}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.topbar h1{font-size:1.5rem;font-weight:700}
.topbar-right{display:flex;align-items:center;gap:12px}
.search-box{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.85rem}
.search-box:focus{outline:none;border-color:var(--primary)}
.user-avatar{width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:#fff}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.metric-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px}
.metric-label{font-size:.8rem;color:var(--text-muted)}
.metric-value{font-size:1.75rem;font-weight:700;margin:4px 0}
.metric-change{font-size:.8rem}.positive{color:var(--success)}.negative{color:var(--error)}
.table-section{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.table-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.table-header h2{font-size:.95rem}
.btn-outline{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.8rem;cursor:pointer}
.btn-outline:hover{border-color:var(--primary);color:var(--primary)}
table{width:100%;border-collapse:collapse}
th,td{padding:12px 20px;text-align:left;font-size:.85rem;border-bottom:1px solid var(--border)}
th{color:var(--text-muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}
.badge{font-size:.75rem;padding:3px 10px;border-radius:20px;font-weight:600}
.badge-success{background:rgba(34,197,94,.15);color:var(--success)}
.badge-warning{background:rgba(245,158,11,.15);color:var(--warning)}
.badge-error{background:rgba(239,68,68,.15);color:var(--error)}
@media(max-width:1024px){.metrics-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sidebar{display:none}.main-content{margin-left:0}.metrics-grid{grid-template-columns:1fr}}`
    },
  },
  {
    id: "freelancer-landing",
    name: "Freelancer Landing Page",
    description: "A professional landing page for freelancers and agencies with services showcase, portfolio preview, testimonials, pricing tiers, and contact form.",
    category: "landing-page",
    platforms: ["replit", "lovable", "vercel", "netlify", "any"],
    tags: ["freelancer", "services", "agency", "business"],
    thumbnail: "linear-gradient(135deg, #0f172a 0%, #164e63 50%, #06b6d4 100%)",
    framework: "html-css",
    version: "1.0.0",
    fileCount: 2,
    downloadCount: 0,
    createdAt: "2026-03-01T00:00:00Z",
    featured: false,
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alex Morgan - Freelance Developer</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<nav class="nav"><div class="container nav-inner"><a href="#" class="logo">Alex<span>Morgan</span></a><div class="nav-links"><a href="#services">Services</a><a href="#work">Work</a><a href="#pricing">Pricing</a><a href="#contact" class="btn btn-sm">Hire Me</a></div></div></nav>
<header class="hero"><div class="container hero-inner"><div class="hero-text"><p class="hero-tag">Freelance Web Developer</p><h1>I build <span class="highlight">websites</span> that drive <span class="highlight">results</span></h1><p class="hero-sub">Full-stack developer specializing in modern web applications, e-commerce solutions, and SaaS products. 7+ years helping businesses grow online.</p><div class="hero-stats"><div><strong>120+</strong><span>Projects</span></div><div><strong>50+</strong><span>Happy Clients</span></div><div><strong>7+</strong><span>Years Exp</span></div></div><a href="#contact" class="btn btn-lg">Let's Work Together</a></div></div></header>
<section id="services" class="section"><div class="container"><h2>What I Do</h2><p class="section-sub">End-to-end services to bring your vision to life</p><div class="services-grid"><div class="service-card"><div class="service-num">01</div><h3>Web Development</h3><p>Custom websites and web applications built with modern technologies. React, Next.js, Node.js, and more.</p></div><div class="service-card"><div class="service-num">02</div><h3>E-Commerce</h3><p>Online stores with payment integration, inventory management, and optimized checkout flows.</p></div><div class="service-card"><div class="service-num">03</div><h3>SaaS Products</h3><p>Full-stack SaaS applications with user auth, billing, dashboards, and API integrations.</p></div><div class="service-card"><div class="service-num">04</div><h3>Consulting</h3><p>Technical strategy, code reviews, architecture audits, and performance optimization.</p></div></div></div></section>
<section id="work" class="section section-alt"><div class="container"><h2>Recent Work</h2><div class="work-grid"><div class="work-card" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)"><div class="work-inner"><h3>FinTrack Pro</h3><p>Financial dashboard SaaS with real-time analytics</p><span class="work-tag">React &middot; Node.js &middot; PostgreSQL</span></div></div><div class="work-card" style="background:linear-gradient(135deg,#10b981,#059669)"><div class="work-inner"><h3>EcoShop</h3><p>Sustainable products marketplace with 10K+ SKUs</p><span class="work-tag">Next.js &middot; Stripe &middot; Sanity</span></div></div><div class="work-card" style="background:linear-gradient(135deg,#f59e0b,#d97706)"><div class="work-inner"><h3>LearnHub</h3><p>Online learning platform with video streaming</p><span class="work-tag">React &middot; AWS &middot; FFmpeg</span></div></div></div></div></section>
<section class="section"><div class="container"><h2>What Clients Say</h2><div class="testimonials"><div class="testimonial"><p>"Alex delivered our project ahead of schedule and the quality exceeded our expectations. Highly recommend."</p><strong>Sarah M.</strong><span>CEO, TechStart</span></div><div class="testimonial"><p>"Professional, communicative, and technically excellent. Alex is our go-to developer for all projects."</p><strong>James P.</strong><span>Founder, GrowthLab</span></div></div></div></section>
<section id="pricing" class="section section-alt"><div class="container"><h2>Pricing</h2><p class="section-sub">Transparent pricing for every budget</p><div class="pricing-grid"><div class="price-card"><h3>Starter</h3><div class="price-amount">$2,500</div><p class="price-desc">Perfect for small businesses</p><ul><li>5-page responsive website</li><li>Contact form</li><li>SEO basics</li><li>2 rounds of revisions</li><li>2-week delivery</li></ul><a href="#contact" class="btn btn-outline">Get Started</a></div><div class="price-card featured"><div class="price-badge">Popular</div><h3>Professional</h3><div class="price-amount">$5,000</div><p class="price-desc">For growing businesses</p><ul><li>10+ page website or web app</li><li>Custom design</li><li>CMS integration</li><li>Analytics setup</li><li>Unlimited revisions</li><li>4-week delivery</li></ul><a href="#contact" class="btn">Get Started</a></div><div class="price-card"><h3>Enterprise</h3><div class="price-amount">Custom</div><p class="price-desc">For complex projects</p><ul><li>Full-stack application</li><li>API development</li><li>Third-party integrations</li><li>Performance optimization</li><li>Ongoing support</li></ul><a href="#contact" class="btn btn-outline">Contact Me</a></div></div></div></section>
<section id="contact" class="section"><div class="container"><h2>Let's Talk</h2><p class="section-sub">Have a project in mind? I'd love to hear about it.</p><form class="contact-form"><div class="form-row"><div class="form-group"><label>Name</label><input type="text" placeholder="Your name"></div><div class="form-group"><label>Email</label><input type="email" placeholder="your@email.com"></div></div><div class="form-group"><label>Project Type</label><select><option>Web Development</option><option>E-Commerce</option><option>SaaS Product</option><option>Consulting</option><option>Other</option></select></div><div class="form-group"><label>Project Details</label><textarea rows="5" placeholder="Tell me about your project, timeline, and budget..."></textarea></div><button type="submit" class="btn btn-lg btn-full">Send Message</button></form></div></section>
<footer class="footer"><div class="container footer-inner"><p>&copy; 2026 Alex Morgan. All rights reserved.</p><div class="social-links"><a href="#">GitHub</a><a href="#">LinkedIn</a><a href="#">Twitter</a></div></div></footer>
</body>
</html>`,
      "styles.css": `*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#06b6d4;--primary-dark:#0891b2;--bg:#0f172a;--bg-alt:#1e293b;--card:#1e293b;--text:#e2e8f0;--text-muted:#94a3b8;--border:#334155;--radius:10px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(12px);background:rgba(15,23,42,.85);border-bottom:1px solid var(--border)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-size:1.2rem;font-weight:700;color:var(--text);text-decoration:none}.logo span{color:var(--primary)}
.nav-links{display:flex;align-items:center;gap:24px}.nav-links a{color:var(--text-muted);text-decoration:none;font-size:.875rem;transition:color .2s}.nav-links a:hover{color:var(--primary)}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;border-radius:var(--radius);font-weight:600;font-size:.9rem;text-decoration:none;border:none;cursor:pointer;transition:all .2s;background:var(--primary);color:#fff}
.btn:hover{background:var(--primary-dark);transform:translateY(-1px)}
.btn-sm{padding:8px 16px;font-size:.8rem}
.btn-lg{padding:14px 32px;font-size:1rem}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--primary);color:var(--primary);background:transparent}
.btn-full{width:100%}
.hero{padding:140px 0 80px}
.hero-tag{color:var(--primary);font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px}
.hero h1{font-size:clamp(2rem,5vw,3rem);font-weight:800;line-height:1.15;margin-bottom:20px}
.highlight{color:var(--primary)}
.hero-sub{font-size:1.05rem;color:var(--text-muted);max-width:560px;margin-bottom:28px}
.hero-stats{display:flex;gap:32px;margin-bottom:32px}
.hero-stats div{display:flex;flex-direction:column}
.hero-stats strong{font-size:1.5rem}
.hero-stats span{font-size:.8rem;color:var(--text-muted)}
.section{padding:80px 0}.section-alt{background:var(--bg-alt)}
.section h2{font-size:2rem;font-weight:700;text-align:center;margin-bottom:8px}
.section-sub{text-align:center;color:var(--text-muted);margin-bottom:48px;max-width:480px;margin-left:auto;margin-right:auto}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.service-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;transition:border-color .2s}
.service-card:hover{border-color:var(--primary)}
.service-num{font-size:2rem;font-weight:800;color:var(--primary);opacity:.3;margin-bottom:8px}
.service-card h3{font-size:1.05rem;margin-bottom:8px}
.service-card p{font-size:.85rem;color:var(--text-muted)}
.work-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.work-card{border-radius:16px;overflow:hidden;min-height:240px;display:flex;align-items:flex-end;position:relative}
.work-inner{padding:28px;background:linear-gradient(transparent,rgba(0,0,0,.7));width:100%;color:#fff}
.work-inner h3{font-size:1.2rem;margin-bottom:4px}
.work-inner p{font-size:.85rem;opacity:.8;margin-bottom:8px}
.work-tag{font-size:.75rem;opacity:.7}
.testimonials{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px;margin:0 auto}
.testimonial{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px}
.testimonial p{font-style:italic;color:var(--text-muted);margin-bottom:16px;font-size:.95rem}
.testimonial strong{display:block;font-size:.9rem}
.testimonial span{font-size:.8rem;color:var(--text-muted)}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:960px;margin:0 auto}
.price-card{background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:32px;text-align:center;position:relative}
.price-card.featured{border-color:var(--primary);background:linear-gradient(180deg,rgba(6,182,212,.08),transparent)}
.price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;padding:4px 16px;border-radius:20px;font-size:.75rem;font-weight:600}
.price-card h3{font-size:1.1rem;margin-bottom:4px}
.price-amount{font-size:2.5rem;font-weight:800;margin:12px 0 4px}
.price-desc{font-size:.85rem;color:var(--text-muted);margin-bottom:20px}
.price-card ul{list-style:none;text-align:left;margin-bottom:24px}
.price-card ul li{padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text-muted)}
.price-card ul li::before{content:"\\2713 ";color:var(--primary);font-weight:700}
.contact-form{max-width:600px;margin:0 auto}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:.8rem;font-weight:600;margin-bottom:6px;color:var(--text-muted)}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--card);color:var(--text);font-size:.9rem;font-family:inherit}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:var(--primary)}
.footer{padding:24px 0;border-top:1px solid var(--border)}
.footer-inner{display:flex;align-items:center;justify-content:space-between}
.footer p{font-size:.8rem;color:var(--text-muted)}
.social-links{display:flex;gap:16px}
.social-links a{color:var(--text-muted);text-decoration:none;font-size:.85rem;transition:color .2s}
.social-links a:hover{color:var(--primary)}
@media(max-width:768px){.nav-links{display:none}.hero-stats{flex-wrap:wrap;gap:20px}.testimonials{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}.footer-inner{flex-direction:column;gap:16px;text-align:center}}`
    },
  },
];

export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATE_CATALOG.filter(t => t.category === category);
}

export function getFeaturedTemplates(): Template[] {
  return TEMPLATE_CATALOG.filter(t => t.featured);
}

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATE_CATALOG.find(t => t.id === id);
}
