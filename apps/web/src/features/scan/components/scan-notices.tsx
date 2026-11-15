import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

interface ScanNoticesProps {
  unavailable: boolean;
  scanError: string | null;
  cameraAvailable: boolean | null;
}

export function ScanNotices({ unavailable, scanError, cameraAvailable }: ScanNoticesProps) {
  return (
    <>
      {unavailable && (
        <Card className="mt-4">
          <CardContent>
            <p className="font-medium">{m.scan_unavailable()}</p>
          </CardContent>
        </Card>
      )}

      {scanError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{scanError}</AlertDescription>
        </Alert>
      )}

      {cameraAvailable === false && (
        <p className="text-muted-foreground mt-4">{m.scan_notices_https()}</p>
      )}
    </>
  );
}
