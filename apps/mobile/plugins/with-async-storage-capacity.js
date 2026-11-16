const { withGradleProperties } = require("expo/config-plugins");

// Chunk rows avoid CursorWindow limits. This separate, bounded database cap
// leaves room for saved banks and drafts while writes still fail without eviction.
module.exports = function withAsyncStorageCapacity(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) =>
        item.type !== "property" || item.key !== "AsyncStorage_db_size_in_MB",
    );
    config.modResults.push({
      type: "property",
      key: "AsyncStorage_db_size_in_MB",
      value: "50",
    });
    return config;
  });
};
