import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function IntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6 tracking-tight">
            QuickCopy
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            One-click copy buttons for the five pieces of page metadata
            marketers and content authors paste most often — Live URL, Preview
            URL, Item ID, Page Title, and a Share Link split-button. Lives
            inside the SitecoreAI Pages editor as a right-hand context panel,
            keyboard-operable end to end, with first-class light and dark
            themes and persistent error states instead of silent failures.
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 mb-16 border border-border/50">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Project Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="font-medium text-foreground">Title</div>
              <div className="text-muted-foreground">QuickCopy</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Author</div>
              <div className="text-muted-foreground">Christian Hahn</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Version</div>
              <div className="text-muted-foreground">1.1.0</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Released at (V1)</div>
              <div className="text-muted-foreground">27.04.2026</div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="font-medium text-foreground">
                Extension Points
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Pages Context Panel</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 max-w-2xl mx-auto gap-8">
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Pages Context Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col flex-grow">
              <div className="bg-muted rounded-lg overflow-hidden">
                <Image
                  src="/panel.png"
                  alt="QuickCopy panel inside the SitecoreAI Pages editor"
                  width={720}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardDescription className="text-sm leading-relaxed flex-grow">
                Five action cards (Live URL, Preview URL, Item ID, Page Title,
                Share Link) plus a theme toggle and a shortcut legend. The
                Share Link split-button copies a Markdown link by default with
                a dropdown for a plain-text variant. Keyboard shortcuts Alt+L
                / Alt+P / Alt+I / Alt+T / Alt+S are visible at the bottom of
                the panel. The Live URL is disabled with a tooltip when the
                page is not published to Edge; failed API calls leave a
                visible mark instead of pretending to succeed.
              </CardDescription>
              <Link href="/panel" className="mt-auto mb-2">
                <Button variant="outline" className="w-full bg-transparent">
                  Open Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
