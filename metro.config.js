// Metro only needs the mobile app. The web dashboard lives in its own
// project with its own node_modules, and crawling it makes the first
// bundle take forever.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const root = path.resolve(__dirname);

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Blocks a folder in the project root only, never inside node_modules. */
function blockFolder(name) {
  const target = escape(path.resolve(root, name));
  return new RegExp(`^${target}[\\\\/]`);
}

const blocked = [
  blockFolder('web'),
  blockFolder('dist-web-verify'),
  blockFolder('supabase'),
  blockFolder('docs'),
  blockFolder('dist'),
  blockFolder('.git'),
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...blocked,
];

module.exports = config;
