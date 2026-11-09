// Override inherited fixture flags before Vite loads env files for this process.
process.env.VITE_USE_FIXTURES = "false";
const { createServer } = await import("vite");
const server = await createServer({ server: { host: "127.0.0.1", strictPort: true } });
await server.listen();
server.printUrls();
