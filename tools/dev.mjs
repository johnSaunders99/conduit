import { buildContent, contentOptions, source } from './content.mjs';
import { createServer } from 'vite';
const args=process.argv.slice(2);
buildContent(source(args),undefined,contentOptions(args));
const server = await createServer();
await server.listen();
server.printUrls();
