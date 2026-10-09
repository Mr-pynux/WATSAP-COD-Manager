import { execSync } from "child_process";

// 1. Fetch current production URL to NEVER delete
let currentProd = "";
try {
  const projOut = execSync("npx vercel project ls", { encoding: "utf8" });
  console.log("Project list:\n", projOut);
} catch (e) {
  console.error(e);
}

// 2. Fetch deployments page by page
let allDeployments = [];
let next = null;

for (let page = 0; page < 10; page++) {
  const cmd = next ? `npx vercel ls --next ${next}` : `npx vercel ls`;
  console.log(`\nFetching deployments (page ${page + 1}): ${cmd}`);
  let out = "";
  try {
    out = execSync(`${cmd} 2>&1`, { encoding: "utf8" });
  } catch (err) {
    out = err.stdout?.toString() || "" + err.stderr?.toString() || "";
  }

  const urls = out.match(/https:\/\/watsap-[a-z0-9]+-ayoub-ai\.vercel\.app/g) || [];
  urls.forEach((u) => {
    if (!allDeployments.includes(u)) allDeployments.push(u);
  });

  const nextMatch = out.match(/--next ([0-9]+)/);
  if (nextMatch && nextMatch[1] !== next) {
    next = nextMatch[1];
  } else {
    break;
  }
}

console.log(`\nFound total ${allDeployments.length} deployments.`);

// Always protect the latest 3 deployments (including active production)
const protectedDeployments = allDeployments.slice(0, 3);
const toDelete = allDeployments.slice(3);

console.log("\n🛡️ PROTECTED (Will NEVER delete):");
protectedDeployments.forEach((u) => console.log("  -", u));

console.log(`\n🗑️ OLD OBSOLETE DEPLOYMENTS TO REMOVE (${toDelete.length}):`);
toDelete.forEach((u) => console.log("  -", u));

// Delete in batches of 5
let deletedCount = 0;
for (let i = 0; i < toDelete.length; i += 5) {
  const batch = toDelete.slice(i, i + 5);
  console.log(`\nDeleting batch ${Math.floor(i / 5) + 1} (${batch.length} deployments)...`);
  try {
    const urlsArg = batch.join(" ");
    const delOut = execSync(`npx vercel rm ${urlsArg} --yes 2>&1`, { encoding: "utf8" });
    console.log(delOut.trim());
    deletedCount += batch.length;
  } catch (delErr) {
    console.error("Batch delete error:", delErr.message);
  }
}

console.log(`\n✅ Finished cleanup! Successfully removed ${deletedCount} old deployments.`);
console.log(`Remaining active deployments: ${protectedDeployments.length}`);
