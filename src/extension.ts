import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

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

    context.subscriptions.push(disposable);
}

export function deactivate() {}