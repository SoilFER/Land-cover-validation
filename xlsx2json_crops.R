# ============================================================
# Excel (multiple sheets)  ->  JSON (country -> level1 -> level2 -> level3)
# Country is taken from the sheet name (suffix after last "_"),
# e.g., "Crop_list_GTM" -> "GTM"
#
# Input Excel requirements (per sheet):
# - Must contain exactly 3 conceptual columns: Level 1, Level 2, Level 3
# - Column names can vary (e.g., "Level_1", "Level 1", "Leve1", etc.)
# - Each row represents one Level_3 item within a Level_2 within a Level_1
# ============================================================

# Working directory
setwd(dirname(rstudioapi::getActiveDocumentContext()$path))
rm(list = ls())

library(readxl)
library(jsonlite)
library(stringi)

# ----------------------------
# Paths (edit as needed)
# ----------------------------
PATH_XLSX <- "List_of_crops_update_all.xlsx"
PATH_JSON_OUT <- "crops_from_excel.json"

# Optional: if you want to compare/align with an existing JSON structure
# PATH_JSON_TEMPLATE <- "/mnt/data/crops.json"

# ----------------------------
# Helpers
# ----------------------------

# Normalize column names for robust matching
norm_name <- function(x) {
  x <- tolower(trimws(x))
  x <- gsub("[^a-z0-9]+", "", x)
  x
}

# Convert labels to JSON keys (snake_case, ASCII, lower)
slug_key <- function(x) {
  x <- trimws(as.character(x))
  x <- stringi::stri_trans_general(x, "Latin-ASCII")
  x <- tolower(x)
  x <- gsub("[^a-z0-9]+", "_", x)
  x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x)
  x
}

# Title-case label (keeps accents if present; only trims)
label_clean <- function(x) {
  trimws(as.character(x))
}

# Detect the 3 required columns in a sheet, allowing messy/varied names
detect_level_columns <- function(df) {
  cn <- colnames(df)
  nn <- vapply(cn, norm_name, character(1))
  
  # Candidates for each level
  # Level 1: "level1", "leve1", "lvl1", etc.
  i1 <- which(nn %in% c("level1", "leve1", "lvl1"))
  # Level 2: "level2", "leve2", "lvl2", etc.
  i2 <- which(nn %in% c("level2", "leve2", "lvl2"))
  # Level 3: "level3", "leve3", "lvl3", etc.
  i3 <- which(nn %in% c("level3", "leve3", "lvl3", "leve21")) # "Leve2.1" becomes "leve21"
  
  # If exact matches fail, fall back to first 3 non-empty columns
  if (length(i1) == 0 || length(i2) == 0 || length(i3) == 0) {
    # Prefer columns with most non-NA values
    non_na <- vapply(df, function(z) sum(!is.na(z) & trimws(as.character(z)) != ""), integer(1))
    ord <- order(non_na, decreasing = TRUE)
    if (length(ord) < 3) stop("Cannot detect 3 columns with data in this sheet.")
    return(list(level1 = cn[ord[1]], level2 = cn[ord[2]], level3 = cn[ord[3]]))
  }
  
  # If multiple matches (e.g., duplicated blocks), take the first match of each
  list(level1 = cn[i1[1]], level2 = cn[i2[1]], level3 = cn[i3[1]])
}

# Extract country code from sheet name.
# Examples:
# - "Crop_list_GTM" -> "GTM"
# - "GTM" -> "GTM"
get_country_from_sheet <- function(sheet_name) {
  parts <- strsplit(sheet_name, "_", fixed = TRUE)[[1]]
  code <- parts[length(parts)]
  toupper(trimws(code))
}

# Map sheet suffix codes to the codes used in your JSON (if needed)
# (This handles common inconsistencies seen in the workbook, e.g., KNY vs KEN.)
normalize_country_code <- function(code) {
  map <- c(
    "KNY" = "KEN",
    "GH"  = "GHA",
    "MZB" = "MOZ"
  )
  if (code %in% names(map)) map[[code]] else code
}

# ----------------------------
# Main conversion
# ----------------------------
sheets <- excel_sheets(PATH_XLSX)

out <- list()

for (sh in sheets) {
  df <- read_excel(PATH_XLSX, sheet = sh)
  
  # Detect correct columns (robust to "Level_1"/"Level 1"/"Leve1", etc.)
  cols <- detect_level_columns(df)
  
  # Keep only those three columns, rename to standard internal names
  d <- data.frame(
    level1 = df[[cols$level1]],
    level2 = df[[cols$level2]],
    level3 = df[[cols$level3]],
    stringsAsFactors = FALSE
  )
  
  # Drop empty rows
  d$level1 <- label_clean(d$level1)
  d$level2 <- label_clean(d$level2)
  d$level3 <- label_clean(d$level3)
  
  keep <- !(is.na(d$level1) | d$level1 == "" | is.na(d$level2) | d$level2 == "" | is.na(d$level3) | d$level3 == "")
  d <- d[keep, , drop = FALSE]
  
  if (nrow(d) == 0) next
  
  country <- normalize_country_code(get_country_from_sheet(sh))
  
  # Build nested structure: level1 -> level2 -> level3 (unique, in appearance order)
  country_obj <- list()
  
  # Preserve order of appearance of level1, then level2 within each level1
  level1_vals <- unique(d$level1)
  
  for (l1_label in level1_vals) {
    l1_key <- slug_key(l1_label)
    
    l1_rows <- d[d$level1 == l1_label, , drop = FALSE]
    level2_vals <- unique(l1_rows$level2)
    
    level2_obj <- list()
    
    for (l2_label in level2_vals) {
      l2_key <- slug_key(l2_label)
      
      l2_rows <- l1_rows[l1_rows$level2 == l2_label, , drop = FALSE]
      l3_vals <- unique(l2_rows$level3)
      
      level2_obj[[l2_key]] <- list(
        label  = l2_label,
        level3 = as.list(l3_vals)
      )
    }
    
    country_obj[[l1_key]] <- list(
      label  = l1_label,
      level2 = level2_obj
    )
  }
  
  out[[country]] <- country_obj
}

# ----------------------------
# Write JSON
# ----------------------------
json_text <- toJSON(out, pretty = TRUE, auto_unbox = TRUE, null = "null")
writeLines(json_text, PATH_JSON_OUT)

cat("Wrote JSON to:", PATH_JSON_OUT, "\n")
