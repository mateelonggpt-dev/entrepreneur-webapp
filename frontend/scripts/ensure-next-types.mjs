import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  {
    path: ".next/types/package.json",
    content: '{ "type": "module" }\n',
  },
  {
    path: ".next/types/app/layout.ts",
    content: "export {};\n",
  },
  {
    path: ".next/types/app/[[...slug]]/page.ts",
    content: "export {};\n",
  },
];

for (const file of files) {
  const target = resolve(process.cwd(), file.path);
  if (existsSync(target)) {
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.content, "utf8");
}
