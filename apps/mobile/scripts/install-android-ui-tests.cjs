/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const file = path.join(__dirname, "../android/app/build.gradle");
const directive = '\napply from: "../../e2e/android/test.gradle"\n';
const source = fs.readFileSync(file, "utf8");
if (!source.includes(directive.trim())) fs.appendFileSync(file, directive);
console.log("Android native UI test source and runner configured.");
