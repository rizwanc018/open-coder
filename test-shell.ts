// test-shell.ts

console.log("1. Starting");

const command = "echo 'console.log(\"Hello World\")' > hello.js";
const shell = process.platform === "win32" ? ["cmd.exe", "/c", command] : ["/bin/bash", "-c", command];

console.log("2. Shell:", shell);

try {
    console.log("3. Before Bun.spawn");

    const cwd = process.cwd();

    const env = {
        ...process.env,
    };

    console.log({ cwd, env });
    const timeoutSignal = AbortSignal.timeout(120_000);

    const proc = Bun.spawn(shell, {
        cwd,
        env,
        stdout: "pipe",
        stderr: "pipe",
        signal: timeoutSignal,
    });

    console.log("4. Bun.spawn returned");

    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);

    console.log("5. Process finished");

    console.log({
        stdout,
        stderr,
        exitCode,
    });
} catch (error) {
    console.error("ERROR:", error);
}
