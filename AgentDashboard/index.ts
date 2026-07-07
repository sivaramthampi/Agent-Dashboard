import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { App } from "./components/App";

export class AgentDashboard implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    // `Root` is React 18's handle for "this DOM node is managed by React."
    // We create it once in init() and reuse it on every updateView() —
    // React then diffs the new output against what's on screen and only
    // touches the parts of the DOM that actually changed.
    private root!: ReactDOM.Root;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.root = ReactDOM.createRoot(container);
        this.renderControl(context);
    }

    // The platform calls this whenever bound data or parameters change.
    // All we do here is hand the latest context to React as props —
    // the App component owns its own state and polling from here on.
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.renderControl(context);
    }

    private renderControl(context: ComponentFramework.Context<IInputs>): void {
        const refreshIntervalSeconds = context.parameters.refreshIntervalSeconds?.raw ?? 15;

        // Extract userId — try multiple PCF approaches with Xrm fallback
        let userId = "";
        try {
            interface UserSettingsWithGetUser { getUser?: () => { id?: string }; }
            interface WinXrm { Xrm?: { Utility?: { getGlobalContext?: () => { getUserId?: () => string } }; }; }
            const us = context.userSettings as ComponentFramework.UserSettings & UserSettingsWithGetUser;
            const raw: string =
                (us as { userId?: string })?.userId ??
                us?.getUser?.()?.id ??
                (window as unknown as WinXrm)?.Xrm?.Utility?.getGlobalContext?.()?.getUserId?.() ??
                "";
            userId = raw.replace(/[{}]/g, "").toLowerCase();
        } catch (e) {
            console.warn("[AgentDashboard] Could not get userId", e);
        }
        console.log(
            "%c[AD userId]",
            "background:#7C3AED;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
            userId || "(empty — queue preselect will not work)"
        );

        this.root.render(
            React.createElement(App, {
                webAPI: context.webAPI,
                refreshIntervalSeconds,
                userId
            })
        );
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        this.root?.unmount();
    }
}
