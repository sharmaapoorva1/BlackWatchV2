"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { TABLE_PAGE_SIZES } from "./TablePreferences";
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <Box
      component="nav"
      aria-label="Table pagination"
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5, borderTop: 1, borderColor: "divider", bgcolor: "background.paper", px: 1.5, py: 1.25 }}
    >
      <Typography aria-live="polite" variant="caption" sx={{ fontFamily: "monospace" }}>
        {first}–{last} <Box component="span" sx={{ color: "text.disabled" }}>of</Box> {total}
      </Typography>
      <Box sx={{ display: "flex", width: { xs: "100%", sm: "auto" }, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 78 }}>
          <InputLabel id="rows-per-page-label">Rows</InputLabel>
          <Select
            labelId="rows-per-page-label"
            label="Rows"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {TABLE_PAGE_SIZES.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography sx={{ minWidth: 64, textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "text.secondary" }}>
          {page + 1} / {pageCount}
        </Typography>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </Box>
    </Box>
  );
}
