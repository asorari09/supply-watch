// SYNTHETIC demo data only. This is the CLI entrypoint for the shared dashboard injection routine.
import { injectSyntheticDisruption } from "@/lib/dashboard/inject-demo";

void injectSyntheticDisruption()
  .then((summary) => console.info(JSON.stringify(summary)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
