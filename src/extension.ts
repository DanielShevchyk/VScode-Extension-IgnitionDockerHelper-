import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    // This command name must match the one in your package.json exactly
    let disposable = vscode.commands.registerCommand('ignition-docker.launchBrowser', async () => {
        
        // 1. Grab the active editor window
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found. Please open a YAML file.");
            return;
        }

        // 2. Extract the text
        const documentText = editor.document.getText();

        try {
            // 3. Parse the text into a JavaScript object
            const parsedYaml = yaml.parse(documentText);

            if (!parsedYaml || !parsedYaml.services) {
                vscode.window.showWarningMessage("No Docker 'services' found in this YAML file.");
                return;
            }

            const services = parsedYaml.services;
            let launchedCount = 0;

            // 4. Loop through each service (e.g., "primary", "secondary")
            for (const [serviceName, serviceData] of Object.entries(services)) {
                const svc = serviceData as any; 
                
                // Check if the service has ports defined
                if (svc.ports && Array.isArray(svc.ports)) {
                    for (const portMapping of svc.ports) {
                        
                        // Docker compose ports look like "9088:8088"
                        // We split by ':' to grab the host port (the first number)
                        const portString = String(portMapping);
                        const parts = portString.split(':');
                        const hostPort = parts[0];
                        const containerPort = parts[1]; // e.g., 8088

                        // Optional: Only launch if it maps to Ignition's default HTTP port (8088)
                        // This prevents opening database or GAN ports accidentally
                        if (hostPort && containerPort && containerPort.includes('8088')) {
                            
                            // 5. Construct the URL matching your requested format
                            const targetUrl = `http://${serviceName}.localhost:${hostPort}`;
                            
                            // 6. Launch the default web browser
                            await vscode.env.openExternal(vscode.Uri.parse(targetUrl));
                            launchedCount++;
                        }
                    }
                }
            }

            // Provide user feedback
            if (launchedCount > 0) {
                vscode.window.showInformationMessage(`Launched ${launchedCount} Ignition Gateway tab(s)!`);
            } else {
                vscode.window.showInformationMessage("No valid Ignition ports (mapping to 8088) found.");
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse YAML. Is it formatted correctly? Error: ${error}`);
        }
    });
    let designerDisposable = vscode.commands.registerCommand('ignition-docker.launchDesigner', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    try {
        const documentText = editor.document.getText();
        const parsedYaml = yaml.parse(documentText);
        
        if (!parsedYaml || !parsedYaml.services) return;

        // 1. Locate the designer-launcher.json file
        // Ignition stores this in the user's home directory across Windows/Mac/Linux
        const homeDir = os.homedir();
        const launcherConfigPath = path.join(homeDir, '.ignition', 'clientlauncher-data', 'designer-launcher.json');

        // 2. Read the existing config (or create a blank template if it doesn't exist)
        let configTemplate: any = { applications: [], global: {} };
        if (fs.existsSync(launcherConfigPath)) {
            const rawData = fs.readFileSync(launcherConfigPath, 'utf8');
            configTemplate = JSON.parse(rawData);
        }

        // 3. Loop through YAML services and add them to the config
        const services = parsedYaml.services;
        let modified = false;

        for (const [serviceName, serviceData] of Object.entries(services)) {
            const svc = serviceData as any;
            if (svc.ports && Array.isArray(svc.ports)) {
                for (const portMapping of svc.ports) {
                    const parts = String(portMapping).split(':');
                    const hostPort = parts[0];
                    const containerPort = parts[1];

                    if (hostPort && containerPort && containerPort.includes('8088')) {
                        const targetUrl = `http://${serviceName}.localhost:${hostPort}`;
                        
                        // Check if this gateway already exists in the JSON
                        const exists = configTemplate.applications.some((app: any) => app.name === serviceName);
                        
if (!exists) {
                            // Add the new gateway configuration matching Ignition's exact schema
                            configTemplate.applications.push({
                                "window.mode": null,
                                "timeout": 30,
                                "screen": null,
                                "retries": -1,
                                "init.heap": null,
                                "max.heap": null,
                                "sun.java2d.d3d": null,
                                "sun.java2d.noddraw": null,
                                "jvm.arguments": [],
                                "client.tag.overrides": {},
                                "fallback.application": "",
                                "use.custom.jre": false,
                                "custom.jre.path": "${JAVA_HOME}/bin/java",
                                "signature.verification.suppress.legacy": false,
                                "name": serviceName,
                                "description": "Auto-generated by VS Code",
                                "gateway.info": {
                                    "gateway.name": serviceName,
                                    "gateway.address": targetUrl,
                                    "redundant.gateways": []
                                },
                                "last.updated": Date.now(),
                                "image.path": null,
                                "favorite": false
                            });
                            modified = true;
                        }
                    }
                }
            }
        }

        // 4. Save the modified JSON back to the hard drive
        if (modified) {
            fs.writeFileSync(launcherConfigPath, JSON.stringify(configTemplate, null, 2), 'utf8');
            vscode.window.showInformationMessage("Updated designer-launcher.json with new Gateways!");
        }

// 5. Launch the actual Designer Launcher executable
        const launcherDir = 'C:\\Program Files\\Inductive Automation\\Designer Launcher';
        const launcherExePath = path.join(launcherDir, 'designerlauncher.exe');

        // PRE-CHECK: Does the file actually exist exactly here?
        if (!fs.existsSync(launcherExePath)) {
            vscode.window.showErrorMessage(`Could not find Designer Launcher at: ${launcherExePath}`);
            return; 
        }

        try {
            const child = spawn(launcherExePath, [], {
                cwd: launcherDir, // <--- THE MAGIC FIX: Runs the exe inside its own folder
                detached: true,
                stdio: 'ignore'
            });

            // Catch asynchronous errors that happen AFTER spawn tries to run
            child.on('error', (err) => {
                vscode.window.showErrorMessage(`Process failed to start: ${err.message}`);
            });

            child.unref(); 
            
        } catch (spawnError) {
            vscode.window.showErrorMessage(`Failed to spawn Designer process: ${spawnError}`);
        }
    } catch (parseError) {  // <--- WE ADDED THIS MISSING CATCH BLOCK
        vscode.window.showErrorMessage(`Failed to parse YAML or modify JSON: ${parseError}`);
    }
});

context.subscriptions.push(designerDisposable);
    context.subscriptions.push(disposable);
}

export function deactivate() {}