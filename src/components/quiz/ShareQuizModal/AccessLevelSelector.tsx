import React from "react";
import "../../../styles/AccessLevelSelector.css";
import {Icon} from "@iconify/react";

interface AccessLevelSelectorProps {
    value: number; // Current access level
    onChange: (level: number) => void; // Callback when access level changes
}

const levels = [
    {value: 0, label: "Prywatny", icon: "mdi-lock"},
    {value: 1, label: "Dla udostępnionych", icon: "mdi-account-multiple"},
    {value: 2, label: "Niepubliczny", icon: "mdi-link"},
    {value: 3, label: "Publiczny", icon: "mdi-earth"},
];

const AccessLevelSelector: React.FC<AccessLevelSelectorProps> = ({value, onChange}) => {
    return (
        <div className="access-level-selector d-flex justify-content-between align-items-center overflow-x-auto">
            {levels.map((level) => {
                const isSelected = value === level.value;
                const isHighlighted = value >= level.value;

                return (
                    <div
                        key={level.value}
                        className={`access-level-item d-flex flex-column align-items-center ${
                            isSelected ? "selected" : ""
                        } ${isHighlighted ? "highlighted" : ""}`}
                        onClick={() => onChange(level.value)}
                    >
                        <Icon icon={level.icon} className="access-level-icon"/>
                        <span className="access-level-label">{level.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default AccessLevelSelector;