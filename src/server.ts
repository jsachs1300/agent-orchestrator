import app from "./app.js";
import { getRedisClient } from "./redis.js";

const port = Number(process.env.PORT || 3000);

async function start() {
  await getRedisClient();
  app.listen(port, () => {
    console.log(`agent-orchestrator listening on ${port}`);
  });
}

start().catch((err) => {
  console.error("failed to start server", err);
  process.exit(1);
});
