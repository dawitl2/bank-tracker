import { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";
import { ProfilePhoto } from "./AccountSettings";
import { useLanguage } from "./Language";
import "./PersonSelectDropdown.css";

export default function PersonSelectDropdown({
  value = "null",
  personOptions = [],
  people = [],
  onChange,
  disabled = false
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedValue = value ?? "null";
  const selectedOption = personOptions.find((opt) => String(opt.value) === String(selectedValue)) || {
    value: selectedValue,
    label: selectedValue === "null" ? "Null" : selectedValue
  };

  const selectedPerson = people.find((p) => String(p.id).toLowerCase() === String(selectedValue).toLowerCase());

  const handleSelect = (val) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`person-select-wrapper ${disabled ? "is-disabled" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`person-select-trigger ${isOpen ? "is-active" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="person-select-trigger-content">
          <ProfilePhoto
            personId={selectedValue}
            name={selectedPerson?.name || selectedOption.label}
            avatar={selectedPerson?.avatar}
            color={selectedPerson?.color}
            className="person-dropdown-thumb"
          />
          <span className="person-select-name">{t(selectedOption.label)}</span>
        </div>
        <FiChevronDown className={`person-select-chevron ${isOpen ? "is-rotated" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="person-select-menu" role="listbox">
          {personOptions.map((option) => {
            const isSelected = String(option.value) === String(selectedValue);
            const personObj = people.find((p) => String(p.id).toLowerCase() === String(option.value).toLowerCase());
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`person-select-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelect(option.value)}
              >
                <ProfilePhoto
                  personId={option.value}
                  name={personObj?.name || option.label}
                  avatar={personObj?.avatar}
                  color={personObj?.color}
                  className="person-dropdown-thumb"
                />
                <div className="person-select-item-text">
                  <span className="person-select-item-name">{t(option.label)}</span>
                  {personObj?.role && (
                    <small className="person-select-item-role">{t(personObj.role)}</small>
                  )}
                </div>
                {isSelected && <FiCheck className="person-select-item-check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
