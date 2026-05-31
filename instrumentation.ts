export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Run prewarm in the background — never block server boot.
  void prewarmAwsCredentials();
  void prewarmPrisma();
}

async function prewarmAwsCredentials() {
  try {
    const { getS3Client } = await import("./lib/server/s3-url");
    const client = getS3Client();
    const credentials = client.config.credentials;
    const provider = typeof credentials === "function" ? credentials : null;
    if (!provider) {
      return;
    }
    const start = Date.now();
    await provider({ callerClientConfig: client.config });
    console.log(`[boot] aws credentials prewarmed in ${Date.now() - start}ms`);
  } catch (error) {
    console.warn("[boot] aws credentials prewarm failed", (error as Error).message);
  }
}

async function prewarmPrisma() {
  try {
    const { prisma } = await import("./lib/prisma");
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[boot] prisma prewarmed in ${Date.now() - start}ms`);
  } catch (error) {
    console.warn("[boot] prisma prewarm failed", (error as Error).message);
  }
}
