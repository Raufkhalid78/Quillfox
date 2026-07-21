"use client";

import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Head>
        <title>Sentry Example</title>
        <meta name="description" content="Test Sentry integration" />
      </Head>

      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <CardTitle>Test Sentry Integration</CardTitle>
          </div>
          <CardDescription>
            Click the button below to throw an intentional error. This will send an event to your Sentry dashboard so you can verify the connection is working.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <Button
            variant="destructive"
            onClick={() => {
              import('@sentry/nextjs').then((Sentry) => {
                Sentry.captureException(new Error("Sentry Test Error from Quillfox Website!"));
                alert("Error sent to Sentry! Check your dashboard.");
              });
            }}
          >
            Throw Test Error
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
