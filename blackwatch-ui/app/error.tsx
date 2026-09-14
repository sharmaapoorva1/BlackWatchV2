"use client";

import { Alert, AlertTitle, Box, Button, Stack, Typography } from "@mui/material";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Box sx={{ maxWidth: 720, mx: "auto", py: { xs: 4, md: 8 }, px: 2 }}>
      <Stack spacing={2}>
        <Alert severity="error" variant="outlined">
          <AlertTitle>This page could not load</AlertTitle>
          The server returned an error while loading this view. Your data was not changed.
        </Alert>
        <Typography color="text.secondary" variant="body2">
          Try again. If the problem persists, check that the API is running and that your session is still valid.
        </Typography>
        <Box>
          <Button variant="contained" onClick={reset}>Try again</Button>
        </Box>
      </Stack>
    </Box>
  );
}
