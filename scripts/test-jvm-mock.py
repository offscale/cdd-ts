#!/usr/bin/env python3
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error


def run_command(command, cwd=None, env=None):
    print(f"Executing: {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd, env=env)
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def is_jvm_ready(port):
    try:
        # Check both /v2 and /api paths just in case it takes time or uses different defaults
        url_v2 = f"http://127.0.0.1:{port}/v2/pet/findByStatus?status=available"
        req = urllib.request.urlopen(url_v2, timeout=2)
        if req.status >= 200 and req.status < 300:
            return True
    except Exception:
        pass

    try:
        url_api = f"http://127.0.0.1:{port}/api/pet/findByStatus?status=available"
        req = urllib.request.urlopen(url_api, timeout=2)
        if req.status >= 200 and req.status < 300:
            return True
    except Exception:
        pass

    return False


def check_command(cmd):
    try:
        subprocess.run(
            [cmd, "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        return True
    except FileNotFoundError:
        return False


def main():
    port = 8080
    docker_container_name = "petstore_server_mock"
    use_prism = False
    started_docker = False

    if is_jvm_ready(port):
        print(
            f"JVM mock server is already running on port {port} (likely GitHub Actions service or left open)."
        )
    else:
        if check_command("docker"):
            print("Starting JVM official petstore server in Docker...")
            subprocess.run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "-d",
                    "-p",
                    f"{port}:8080",
                    "-e",
                    "SWAGGER_BASE_PATH=/v2",
                    "--name",
                    docker_container_name,
                    "swaggerapi/petstore",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            started_docker = True
            print("Waiting for JVM Petstore server to be ready...")
            ready = False
            for _ in range(30):
                if is_jvm_ready(port):
                    ready = True
                    break
                time.sleep(2)
            if not ready:
                print("JVM server failed to become ready. Falling back to Prism.")
                subprocess.run(
                    ["docker", "stop", docker_container_name],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                use_prism = True
        elif check_command("java"):
            print(
                "Java is available but Docker is not. We would run the JVM petstore natively, but it requires downloading complex dependencies. Falling back to Prism (Node.js)."
            )
            use_prism = True
        else:
            use_prism = True

    prism_swagger = None
    prism_oas3 = None

    try:
        if use_prism:
            print("Starting Prism mock servers (fallback non-JVM version)...")
            prism_swagger = subprocess.Popen(
                [
                    "npx",
                    "@stoplight/prism-cli",
                    "mock",
                    "../petstore.json",
                    "-p",
                    "4010",
                    "-d",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            prism_oas3 = subprocess.Popen(
                [
                    "npx",
                    "@stoplight/prism-cli",
                    "mock",
                    "../petstore_oas3.json",
                    "-p",
                    "4011",
                    "-d",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("Waiting for Prism servers to start...")
            ready_prism = False
            for _ in range(30):
                try:
                    req1 = urllib.request.urlopen("http://127.0.0.1:4010", timeout=2)
                    status1 = req1.status
                except urllib.error.HTTPError as e:
                    status1 = e.code
                except Exception:
                    status1 = 500

                try:
                    req2 = urllib.request.urlopen("http://127.0.0.1:4011", timeout=2)
                    status2 = req2.status
                except urllib.error.HTTPError as e:
                    status2 = e.code
                except Exception:
                    status2 = 500

                if status1 < 500 and status2 < 500:
                    ready_prism = True
                    break

                time.sleep(1)

            if not ready_prism:
                print("Timed out waiting for Prism servers to start.")
                sys.exit(1)

        ts_content = """import { StoreClient as SwaggerStoreClient } from './.test_out_swagger/dist/services/store.client.js';
import { PetClient as OpenApiPetClient } from './.test_out_openapi/dist/services/pet.client.js';

async function run() {
    const usePrism = process.env.USE_PRISM === '1';
    const swaggerPort = usePrism ? '4010' : '8080/v2';
    const openapiPort = usePrism ? '4011' : '8080/v2';

    console.log(`Testing Swagger 2.0 SDK against mock server (port ${swaggerPort})...`);
    const swaggerClient = new SwaggerStoreClient(`http://127.0.0.1:${swaggerPort}`);
    await swaggerClient.getInventory({ headers: { api_key: 'special-key' } });
    console.log("Swagger 2.0 OK");

    console.log(`Testing OpenAPI 3.0 SDK against mock server (port ${openapiPort})...`);
    const openapiClient = new OpenApiPetClient(`http://127.0.0.1:${openapiPort}`);
    await openapiClient.findPetsByStatus('available', { headers: { Authorization: 'Bearer test' } });
    console.log("OpenAPI 3.0 OK");
}
run().catch(e => { console.error(e); process.exit(1); });
"""
        with open("test-sdks.ts", "w") as f:
            f.write(ts_content)

        env = os.environ.copy()
        env["USE_PRISM"] = "1" if use_prism else "0"

        run_command(
            [
                "npx",
                "tsc",
                "test-sdks.ts",
                "--module",
                "NodeNext",
                "--moduleResolution",
                "NodeNext",
            ],
            env=env,
        )
        run_command(["node", "test-sdks.js"], env=env)

        if os.path.exists("test-sdks.ts"):
            os.remove("test-sdks.ts")
        if os.path.exists("test-sdks.js"):
            os.remove("test-sdks.js")

    finally:
        if not use_prism:
            if started_docker:
                subprocess.run(
                    ["docker", "stop", docker_container_name],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
        else:
            if prism_swagger:
                prism_swagger.terminate()
            if prism_oas3:
                prism_oas3.terminate()


if __name__ == "__main__":
    main()
