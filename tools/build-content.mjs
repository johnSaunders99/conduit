import { buildContent, contentOptions, source } from './content.mjs';
const args=process.argv.slice(2);
buildContent(source(args),undefined,contentOptions(args));
