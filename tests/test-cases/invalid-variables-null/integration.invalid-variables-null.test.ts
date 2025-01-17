import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("invalid-variables-null <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-variables-null",
            job: "test-job",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} has invalid variables hash of key value pairs. INVALID=null`);
    }
});
