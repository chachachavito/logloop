module.exports.readVersion = function (contents) {
  const match = contents.match(/v(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
};

module.exports.writeVersion = function (contents, version) {
  // Substitui ocorrências de vX.Y.Z (ex: v0.3.0) globalmente no arquivo
  return contents.replace(/v\d+\.\d+\.\d+/g, `v${version}`);
};
