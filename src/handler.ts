import * as yaml from "js-yaml";
import * as chalk from "chalk";
import * as fs from "fs-extra";
import * as yargs from "yargs";
import {Commander} from "./commander";
import {Parser} from "./parser";
import * as state from "./state";
import {assert} from "./asserts";
import * as dotenv from "dotenv";
import * as camelCase from "camelcase";
import * as prettyHrtime from "pretty-hrtime";
import {WriteStreams} from "./types/write-streams";
import {Job} from "./job";

let parser: Parser | null = null;
const checkFolderAndFile = (cwd: string, file?: string) => {
    assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);

    const gitlabFilePath = file ? `${cwd}/${file}` : `${cwd}/.gitlab-ci.yml`;
    assert(fs.existsSync(gitlabFilePath), `${cwd} does not contain ${file ?? ".gitlab-ci.yml"}`);
};

export async function handler(argv: any, writeStreams: WriteStreams) {
    assert(typeof argv.cwd != "object", "--cwd option cannot be an array");
    const cwd = argv.cwd?.replace(/\/$/, "") ?? ".";

    if (fs.existsSync(`${cwd}/.gitlab-ci-local-env`)) {
        const config = dotenv.parse(fs.readFileSync(`${cwd}/.gitlab-ci-local-env`));
        for (const [key, value] of Object.entries(config)) {
            const argKey = camelCase(key);
            if (argv[argKey] == null) {
                argv[argKey] = value;
            }
        }
    }

    if (argv.completion != null) {
        yargs.showCompletionScript();
    } else if (argv.preview != null) {
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create({
            cwd, writeStreams, pipelineIid, tabCompletionPhase: true, file: argv.file, home: argv.home, extraHosts: argv.extraHost,
        });
        const gitlabData = parser.gitlabData;
        for (const jobName of Object.keys(gitlabData)) {
            if (jobName === "stages") {
                continue;
            }
            if (Job.illegalJobNames.includes(jobName) || jobName.startsWith(".")) {
                delete gitlabData[jobName];
            }
        }
        writeStreams.stdout(`${yaml.dump(gitlabData)}`);
    } else if (argv.list != null) {
        checkFolderAndFile(cwd, argv.file);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create({
            cwd, writeStreams, pipelineIid, tabCompletionPhase: false, file: argv.file, home: argv.home, extraHosts: argv.extraHost,
        });
        Commander.runList(parser, writeStreams);
    } else if (argv.job) {
        checkFolderAndFile(cwd, argv.file);
        if (argv.needs === true) {
            await fs.remove(`${cwd}/.gitlab-ci-local/artifacts`);
            await state.incrementPipelineIid(cwd);
        }
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create({
            cwd, writeStreams, pipelineIid, tabCompletionPhase: false, file: argv.file, home: argv.home, extraHosts: argv.extraHost,
        });
        await Commander.runSingleJob(parser, writeStreams, argv.job, argv.needs || false, argv.privileged || false);
    } else {
        const time = process.hrtime();
        checkFolderAndFile(cwd, argv.file);
        await fs.remove(`${cwd}/.gitlab-ci-local/artifacts`);
        await state.incrementPipelineIid(cwd);
        const pipelineIid = await state.getPipelineIid(cwd);
        parser = await Parser.create({
            cwd, writeStreams, pipelineIid, tabCompletionPhase: false, file: argv.file, home: argv.home, extraHosts: argv.extraHost,
        });
        await Commander.runPipeline(parser, writeStreams, argv.manual || [], argv.privileged || false);
        writeStreams.stdout(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();
}

process.on("SIGINT", async (_: string, code: number) => {
    if (!parser) {
        return process.exit(code);
    }
    const promises = [];
    for (const job of parser.getJobs()) {
        promises.push(job.removeContainer());
    }
    await Promise.all(promises);
    process.exit(code);
});
