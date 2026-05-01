import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { startFakeSub2API } from "./support/fake-sub2api";

export const fakeSub2APIInfoPath = path.join(
  process.cwd(),
  "output",
  "playwright",
  "fake-sub2api.json"
);

export default async function globalSetup() {
  const fakeSub2API = await startFakeSub2API();

  await mkdir(path.dirname(fakeSub2APIInfoPath), { recursive: true });
  await writeFile(
    fakeSub2APIInfoPath,
    JSON.stringify({ baseUrl: fakeSub2API.baseUrl }, null, 2)
  );

  return async () => {
    await fakeSub2API.close();
  };
}
