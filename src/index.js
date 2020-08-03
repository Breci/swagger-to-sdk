#!/usr/bin/env node
const fetch = require("node-fetch");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs-extra");
const prettier = require("prettier");

const argv = require("minimist")(process.argv.slice(2));

const outDir = argv.o || "./sdk";
const source = argv.s;

const generateTS = false;

function camelCase(string) {
  return string.replace(/-([a-z])/gi, function (all, letter) {
    return letter.toUpperCase();
  });
}

const capitalize = (s) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function flattenPaths(paths) {
  const flattenedPaths = Object.entries(paths).reduce(
    (reducer, [url, methods]) => {
      const newPaths = Object.entries(methods).reduce((r, [method, data]) => {
        const newPathData = {
          ...data,
          method,
          url,
        };
        return [...r, newPathData];
      }, []);
      return [...reducer, ...newPaths];
    },
    []
  );

  const mappedPaths = flattenedPaths.reduce((reducer, path) => {
    return {
      ...reducer,
      [camelCase(path.tags[0])]: [
        ...(reducer[camelCase(path.tags[0])] || []),
        path,
      ],
    };
  }, {});

  return mappedPaths;
}

const TEMPLATES = {
  CONFIG: {
    path: path.join(__dirname, "./templates/config.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/config.js`),
  },
  CONTROLLER: {
    path: path.join(__dirname, "./templates/controller.ejs"),
    outputPath: (name) =>
      path.join(process.cwd(), `${outDir}/src/controllers/${name}.js`),
  },
  CONTROLLER_INDEX: {
    path: path.join(__dirname, "./templates/controllerIndex.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/controllers/index.js`),
  },
  INSTANCE: {
    path: path.join(__dirname, "./templates/instance.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/instance.js`),
  },
  MODEL: {
    path: path.join(__dirname, "./templates/model.ejs"),
    outputPath: (name) =>
      path.join(process.cwd(), `${outDir}/src/models/${name}.ts`),
  },
  MODEL_INDEX: {
    path: path.join(__dirname, "./templates/modelIndex.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/models/index.ts`),
  },
  PACKAGE_JSON: {
    path: path.join(__dirname, "./templates/package.json.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/package.json`),
  },
  SECURITY: {
    path: path.join(__dirname, "./templates/security.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/security.js`),
  },
  MAIN_INDEX: {
    path: path.join(__dirname, "./templates/mainIndex.ejs"),
    outputPath: path.join(process.cwd(), `${outDir}/src/index.js`),
  },
};

function renderTemplate(templateName, data, fileName) {
  const templateInfo = TEMPLATES[templateName];
  if (!templateInfo) return;

  const template = fs.readFileSync(templateInfo.path, "utf-8");

  const render = ejs.render(template, data);

  const outputFilePath =
    typeof templateInfo.outputPath === "function"
      ? templateInfo.outputPath(fileName)
      : templateInfo.outputPath;
  fs.outputFileSync(
    outputFilePath,
    prettier.format(render, {
      parser: outputFilePath.endsWith(".json") ? "json" : "babel",
    })
  );
}

if (!source) {
  throw new Error("Missing source use -s source");
} else {
  fetch(source)
    .then((res) => res.json())
    .then((data) => {
      if (generateTS) {
        /*
               TYPESCRIPT PART
               */
        // TODO generate models
        // TODO get all the generated model then generate the index
        const modelIndexRender = ejs.render(modelIndexTemplate, {
          models: ["test", "test2"],
        });
      }

      // TODO group paths by operationId and flatten the methods by injecting the info on the object, also inject the url in the object
      // TODO generate controllers that will export all the files
      // TODO generate controllers index

      const paths = flattenPaths(data.paths);

      for (const [controllerName, controllerPaths] of Object.entries(paths)) {
        renderTemplate(
          "CONTROLLER",
          {
            paths: controllerPaths,
            refs: data.components.schemas,
          },
          capitalize(controllerName)
        );
      }

      renderTemplate("CONTROLLER_INDEX", {
        controllers: Object.keys(paths).map((pathName) => capitalize(pathName)),
      });

      renderTemplate("INSTANCE", {
        paths: data.paths,
      });

      renderTemplate("SECURITY", {
        securitySchemes: data.components.securitySchemes,
      });

      renderTemplate("CONFIG", {
        apiUrl: data.servers[0].url,
      });

      renderTemplate("PACKAGE_JSON", {
        name: data.info.title.replace(/[ ]/g, "_").toLowerCase(),
        version: data.info.version.replace("v", ""),
        description: "",
      });

      renderTemplate("MAIN_INDEX", {});
    });
}
