"use client";

import React, { useState, useEffect, useRef } from "react";

interface AutocompleteResult {
  text: string;
}

interface AutocompleteProps {
  onSelect?: (result: AutocompleteResult) => void;
  placeholder?: string;
  maxResults?: number;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  onSelect,
  placeholder = "Search...",
  maxResults = 10,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock search function for demo purposes
  const onSearch = async (
    searchQuery: string
  ): Promise<AutocompleteResult[]> => {
    if (!searchQuery.trim()) return [];

    // Extract the last word from the query
    const words = searchQuery.trim().split(/\s+/);
    const lastWord = words[words.length - 1];

    try {
      const response = await fetch("/api/autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: lastWord }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error("Autocomplete API error:", error);
      return [];
    }
  };

  // Handle search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          const searchResults = await onSearch(query);

          // Split query by space. Then replace last word for the suggestions.
          const words = query.trim().split(/\s+/);
          const precedingWords = words.slice(0, -1);

          const formattedResults = searchResults.map((result, index) => ({
            text:
              precedingWords.length > 0
                ? `${precedingWords.join(" ")} ${result.text}`
                : result.text,
          }));

          setResults(formattedResults);
          setIsOpen(formattedResults.length > 0);
        } catch (error) {
          console.error("Search error:", error);
          setResults([]);
          setIsOpen(false);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
      setSelectedIndex(-1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, onSearch, maxResults]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: AutocompleteResult) => {
    console.log(result.text);
    setQuery(result.text);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSelect?.(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      {/* Google-like logo space */}
      <div className="mb-8">
        <h1 className="text-6xl font-light text-gray-800 tracking-wide">
          Search
        </h1>
      </div>

      {/* Search container */}
      <div ref={containerRef} className="relative w-full max-w-2xl">
        {/* Input field */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-6 py-4 text-lg text-black border border-gray-300 rounded-full shadow-lg hover:shadow-xl focus:shadow-xl focus:outline-none focus:border-blue-500 transition-all duration-200"
            autoComplete="off"
          />

          {/* Search icon */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            ) : (
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Dropdown results */}
        {isOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-150 ${
                  index === selectedIndex ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <div className="text-gray-800 font-medium">
                      {result.text}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search buttons (Google-like) */}
      <div className="mt-8 flex space-x-4">
        <button
          onClick={() => onSelect?.({ id: "search", text: query })}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700 font-medium transition-colors duration-200"
        >
          Search
        </button>
        <button
          onClick={() => {
            setQuery("");
            setResults([]);
            setIsOpen(false);
            inputRef.current?.focus();
          }}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700 font-medium transition-colors duration-200"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default Autocomplete;
