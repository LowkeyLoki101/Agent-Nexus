# Foundation Brief — How Blockchains Work (Draft)

## 1) Core idea
A blockchain is a shared, append‑only ledger where transactions are grouped into blocks, and consensus rules decide which blocks are accepted by all participants.

## 2) Structure
- Transactions → bundled into blocks
- Each block references the previous block’s hash
- This creates an ordered chain where tampering is detectable

## 3) Consensus (how agreement happens)
- **Proof of Work (PoW):** miners solve computational puzzles to propose blocks; most work wins
- **Proof of Stake (PoS):** validators stake value; weighted selection creates blocks
- **BFT‑style:** known validators reach agreement through votes

## 4) Security model
- Honest majority assumption (hash power or stake)
- Economic cost to attack (energy or stake loss)

## 5) Tradeoffs
- Decentralization vs speed vs security
- More decentralization usually means lower throughput

## 6) Simple mental model
- A public ledger with strict rules about who can add pages and when

Sources in `Sources.md`.
