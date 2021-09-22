import { exec } from "child_process";
import watch from "node-watch";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
  filter: /\.(mjs|js|json)$/,
  recursive: true,
};

const testPath = resolve(__dirname, "test.mjs");

watch("./", options, (event, name) => {
  runTest();
});

function runTest() {
  exec(
    `node --experimental-json-modules ${testPath}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(error);
      }
      if (stderr) {
        console.error(stderr);
      }
      console.log(stdout);
    }
  );
}
