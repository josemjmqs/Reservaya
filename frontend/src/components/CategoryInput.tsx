"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui";

// Sin mayúsculas ni tildes, para que "pelo" encuentre "Pelo" y "unas" encuentre "Uñas"
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Campo de texto libre con la lista de categorías existentes debajo.
// Reemplaza a <datalist>, que no se puede estilizar y se ve distinto en cada navegador
export function CategoryInput({
  value,
  onChange,
  options,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  maxLength?: number;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = normalize(value);
  const matches = options.filter((o) => {
    const n = normalize(o);
    // si ya está escrita exacta, no hace falta sugerirla
    return n.includes(query) && n !== query;
  });
  const showList = open && matches.length > 0;

  function pick(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length === 0 ? -1 : (i + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter" && showList && active >= 0) {
      // elegir la opción en vez de enviar el formulario
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown en vez de click: así se elige antes de que el input pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 ${
                i === active ? "bg-indigo-50 text-indigo-700" : "text-gray-700"
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
