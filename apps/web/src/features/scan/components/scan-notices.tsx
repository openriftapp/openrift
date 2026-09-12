import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

interface ScanNoticesProps {
  unavailableMessage: string | null;
  scanError: string | null;
  cameraAvailable: boolean | null;
}

export function ScanNotices({ unavailableMessage, scanError, cameraAvailable }: ScanNoticesProps) {
  return (
    <>
      {unavailableMessage && (
        <Card className="border-destructive mt-4">
          <CardContent className="pt-6">
            <p className="font-medium">{m.scan_notices_unavailable_title()}</p>
            <p className="text-muted-foreground mt-2">{unavailableMessage}</p>
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
