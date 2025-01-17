import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("needs-invalid-stage <build-job> --needs", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/needs-invalid-stage",
            job: "build-job",
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} is needed by {blueBright build-job}, but it is in the same or a future stage`);
    }
});
