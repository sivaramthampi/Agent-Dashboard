import * as React from "react";

export interface ActionToolbarProps {
    selectedContactName: string | null;
    onAssign: () => void;
    onTransfer: () => void;
    onMonitor: () => void;
    onForceClose: () => void;
}

/**
 * These four buttons map to write operations against a live conversation,
 * not reads — so for now they're wired to call back up to App with a
 * console.log placeholder (see App.tsx) rather than touching Dataverse.
 * The actual webAPI.updateRecord (or custom action) call gets filled in
 * once we've confirmed what's actually supported in your environment.
 */
export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    selectedContactName, onAssign, onTransfer, onMonitor, onForceClose
}) => {
    const enabled = selectedContactName !== null;

    return (
        <div className="ad-toolbar">
            <span className="ad-toolbar-hint">
                {enabled ? `${selectedContactName} selected` : "Select a conversation to monitor, transfer, or close"}
            </span>
            <button className={`ad-tbtn${enabled ? " enabled" : ""}`} disabled={!enabled} onClick={onAssign}>
                Assign
            </button>
            <button className={`ad-tbtn${enabled ? " enabled" : ""}`} disabled={!enabled} onClick={onTransfer}>
                Transfer
            </button>
            <button className={`ad-tbtn primary${enabled ? " enabled" : ""}`} disabled={!enabled} onClick={onMonitor}>
                Monitor
            </button>
            <button className={`ad-tbtn danger${enabled ? " enabled" : ""}`} disabled={!enabled} onClick={onForceClose}>
                Force close
            </button>
        </div>
    );
};
