"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const teamIsoMap: Record<string, string> = {
  ARG: "ar", ARGENTINA: "ar",
  FRA: "fr", FRANCE: "fr",
  ESP: "es", SPAIN: "es",
  BRA: "br", BRAZIL: "br",
  ENG: "gb-eng", ENGLAND: "gb-eng",
  GER: "de", GERMANY: "de",
  POR: "pt", PORTUGAL: "pt",
  IRN: "ir", IRAN: "ir", "IR IRAN": "ir",
  IRQ: "iq", IRAQ: "iq",
  JPN: "jp", JAPAN: "jp",
  NGA: "ng", NIGERIA: "ng",
  USA: "us", "UNITED STATES": "us",
  MEX: "mx", MEXICO: "mx",
  URU: "uy", URUGUAY: "uy",
  BEL: "be", BELGIUM: "be",
  NOR: "no", NORWAY: "no",
  KOR: "kr", "SOUTH KOREA": "kr", KOREA: "kr",
  SUI: "ch", SWITZERLAND: "ch",
  KSA: "sa", "SAUDI ARABIA": "sa",
  CRO: "hr", CROATIA: "hr",
  SEN: "sn", SENEGAL: "sn",
  NED: "nl", NETHERLANDS: "nl", HOLLAND: "nl",
  ITA: "it", ITALY: "it",
  MAR: "ma", MOR: "ma", MOROCCO: "ma",
  CAN: "ca", CANADA: "ca",
  EGY: "eg", EGYPT: "eg",
  PAR: "py", PARAGUAY: "py",
  GHA: "gh", GHANA: "gh",
  CIV: "ci", "IVORY COAST": "ci", "COTE D'IVOIRE": "ci",
  CMR: "cm", CAMEROON: "cm",
  ALG: "dz", ALGERIA: "dz",
  TUN: "tn", TUNISIA: "tn",
  RSA: "za", "SOUTH AFRICA": "za",
  AUS: "au", AUSTRALIA: "au",
  NZL: "nz", "NEW ZEALAND": "nz",
  COL: "co", COLOMBIA: "co",
  CHI: "cl", CHILE: "cl",
  PER: "pe", PERU: "pe",
  ECU: "ec", ECUADOR: "ec",
  VEN: "ve", VENEZUELA: "ve",
  BOL: "bo", BOLIVIA: "bo",
  CRC: "cr", "COSTA RICA": "cr",
  PAN: "pa", PANAMA: "pa",
  JAM: "jm", JAMAICA: "jm",
  DEN: "dk", DENMARK: "dk",
  SWE: "se", SWEDEN: "se",
  POL: "pl", POLAND: "pl",
  AUT: "at", AUSTRIA: "at",
  TUR: "tr", TURKEY: "tr",
  GRE: "gr", GREECE: "gr",
  UKR: "ua", UKRAINE: "ua",
  SCO: "gb-sct", SCOTLAND: "gb-sct",
  WAL: "gb-wls", WALES: "gb-wls",
  NIR: "gb-nir", "NORTHERN IRELAND": "gb-nir",
  IRL: "ie", IRELAND: "ie",
  SRB: "rs", SERBIA: "rs",
  CZE: "cz", "CZECH REPUBLIC": "cz", CZECHIA: "cz",
  HUN: "hu", HUNGARY: "hu",
  ROU: "ro", ROMANIA: "ro",
  FIN: "fi", FINLAND: "fi",
  ISL: "is", ICELAND: "is",
  CPV: "cv", "CAPE VERDE": "cv",
  BIH: "ba", "BOSNIA & HERZEGOVINA": "ba", "BOSNIA AND HERZEGOVINA": "ba", BOSNIA: "ba",
  COD: "cd", "CONGO DR": "cd", "DR CONGO": "cd", "DEMOCRATIC REPUBLIC OF THE CONGO": "cd",
  UZB: "uz", UZBEKISTAN: "uz",
  QAT: "qa", QATAR: "qa",
  HAI: "ht", HAITI: "ht",
  CUW: "cw", CURACAO: "cw", "CURAÇAO": "cw",
  JOR: "jo", JORDAN: "jo",
};

interface TeamLogoProps {
  code: string;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function TeamLogo({ code, name, className, size = "md" }: TeamLogoProps) {
  const [hasError, setHasError] = useState(false);

  const cleanKey = (name || code).toUpperCase().trim();
  const codeKey = code.toUpperCase().trim();
  const iso = teamIsoMap[cleanKey] || teamIsoMap[codeKey];

  const sizeClasses = {
    sm: "h-5 w-7 text-[0.58rem]",
    md: "h-7 w-10 sm:h-11 sm:w-14 text-[0.68rem] sm:text-xs",
    lg: "h-9 w-12 sm:h-14 sm:w-18 text-xs sm:text-sm",
  }[size];

  if (!iso || hasError) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-surface)] font-mono font-semibold uppercase text-[var(--terminal-text-strong)] shadow-inner",
          sizeClasses,
          className,
        )}
      >
        {code.slice(0, 3)}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-[var(--terminal-border)] bg-[#09151f] shadow-sm",
        sizeClasses,
        className,
      )}
    >
      <img
        src={`https://flagcdn.com/w160/${iso}.png`}
        alt={`${name || code} flag`}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
