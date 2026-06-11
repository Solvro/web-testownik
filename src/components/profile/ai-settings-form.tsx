import { BotIcon, CheckIcon, CopyIcon, CrownIcon } from "lucide-react";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import {
  SELECTABLE_AI_MODEL_OPTIONS,
  getSelectableAiModelOption,
  isSelectableAiModel,
  resolveSelectableAiModel,
} from "@/lib/ai/models";
import { PermissionAction } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { ACCOUNT_LEVEL } from "@/types/user";
import type { SettingsFormProps } from "@/types/user";

interface CopyableSnippetProps {
  copiedKey: string | null;
  label: string;
  onCopy: (value: string, key: string) => void;
  value: string;
}

function CopyableSnippet({
  copiedKey,
  label,
  onCopy,
  value,
}: CopyableSnippetProps) {
  const isCopied = copiedKey === label;

  return (
    <div className="bg-muted/30 min-w-0 rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">{label}</p>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => {
            onCopy(value, label);
          }}
          aria-label={`Skopiuj: ${label}`}
          className="shrink-0"
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <pre className="text-foreground max-w-full overflow-x-auto rounded-sm font-mono text-xs leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
}

interface SetupStepProps {
  children: React.ReactNode;
  title: string;
}

function SetupStep({ children, title }: SetupStepProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}

interface ClientSetupTabProps {
  children: React.ReactNode;
  label: string;
}

const MCP_CLIENTS = [
  { label: "Ogólne", value: "general" },
  { label: "Claude Code", value: "claude-code" },
  { label: "Claude Desktop", value: "claude-desktop" },
  { label: "VS Code", value: "vscode" },
] as const;

function ClientSetupTab({ children, label }: ClientSetupTabProps) {
  return (
    <TabsContent value={label} className="flex flex-col gap-2">
      {children}
    </TabsContent>
  );
}

export function AiSettingsForm({
  settings,
  disabled = false,
  onSettingChange,
}: SettingsFormProps) {
  const { checkPermission, user } = useContext(AppContext);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("general");

  const hasAiAccess = checkPermission(PermissionAction.AI_FEATURES);
  const canSelectAiModel =
    hasAiAccess && user?.account_level === ACCOUNT_LEVEL.GOLD;
  const selectedAiModel = resolveSelectableAiModel(settings.default_ai_model);
  const selectedAiModelOption = getSelectableAiModelOption(selectedAiModel);
  const mcpEndpoint = `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/mcp`;
  const claudeCodeCommand = `claude mcp add --transport http testownik ${mcpEndpoint}`;

  const copyCommand = async (command: string, label: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(label);
      toast.success("Skopiowano do schowka.");
      setTimeout(() => {
        setCopiedCommand((current) => (current === label ? null : current));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy MCP command", error);
      toast.error("Nie udało się skopiować komendy.");
    }
  };

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotIcon className="size-5" />
          Sztuczna inteligencja
        </CardTitle>
      </CardHeader>
      <CardContent
        aria-busy={disabled}
        className={cn("flex flex-col gap-6", disabled && "animate-pulse")}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <Label
              className={cn(
                "text-sm font-medium",
                !hasAiAccess && "text-muted-foreground",
              )}
              htmlFor="ai-enabled"
            >
              Wbudowane AI
            </Label>
            <p className="text-muted-foreground text-xs">
              Aktywuj generowanie quizów, czat AI, podpowiedzi i wszystkie inne
              wbudowane funkcje AI
            </p>
          </div>
          <Switch
            id="ai-enabled"
            checked={!settings.ai_disabled}
            onCheckedChange={(checked) => {
              onSettingChange("ai_disabled", !checked);
            }}
            disabled={disabled || !hasAiAccess}
            className="ml-auto"
          />
        </div>
        {canSelectAiModel ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-0">
              <Label
                className="flex items-center gap-2 text-sm font-medium"
                htmlFor="default-ai-model"
              >
                Domyślny model AI
                <Badge
                  variant="outline"
                  className="border-amber-300/60 bg-amber-100/70 text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/15 dark:text-amber-200"
                >
                  <CrownIcon />
                  Gold
                </Badge>
              </Label>
              <p className="text-muted-foreground text-xs">
                Model startowy dla czatu AI i wyjaśnień pytań. W czacie możesz
                zmienić go tymczasowo.
              </p>
            </div>
            <Select
              disabled={disabled}
              items={SELECTABLE_AI_MODEL_OPTIONS}
              value={selectedAiModel}
              onValueChange={(value) => {
                if (isSelectableAiModel(value)) {
                  onSettingChange("default_ai_model", value);
                }
              }}
            >
              <SelectTrigger
                id="default-ai-model"
                aria-label="Wybierz domyślny model AI"
                className="w-full shrink-0 md:ml-auto md:w-56"
                disabled={disabled}
              >
                <AiModelProviderIcon
                  provider={selectedAiModelOption.provider}
                />
                <span className="truncate">{selectedAiModelOption.label}</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger>
                <SelectGroup>
                  {SELECTABLE_AI_MODEL_OPTIONS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <AiModelProviderIcon provider={model.provider} />
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Testownik MCP</p>
              <p className="text-muted-foreground text-xs">
                Dodaj Testownika do klienta MCP, żeby asystent mógł pracować z
                Twoimi quizami po zalogowaniu.
              </p>
            </div>
          </div>
          <Tabs
            value={selectedClient}
            onValueChange={setSelectedClient}
            className="min-w-0"
          >
            <Select
              items={MCP_CLIENTS}
              value={selectedClient}
              onValueChange={(value) => {
                if (value !== null) {
                  setSelectedClient(value);
                }
              }}
            >
              <SelectTrigger
                aria-label="Wybierz klienta MCP"
                className="w-full md:hidden"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MCP_CLIENTS.map((client) => (
                    <SelectItem key={client.value} value={client.value}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <TabsList className="hidden md:inline-flex">
              {MCP_CLIENTS.map((client) => (
                <TabsTrigger key={client.value} value={client.value}>
                  {client.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ClientSetupTab label="general">
              <SetupStep title="Adres serwera">
                Podaj ten adres serwera MCP w kliencie, którego używasz, żeby
                dodać Testownik jako zdalny serwer MCP. Wymagana jest obsługa
                CIMD.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Endpoint MCP"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={mcpEndpoint}
              />
              <SetupStep title="Logowanie">
                Po dodaniu serwera klient powinien uruchomić logowanie do
                Testownika przy pierwszym połączeniu.
              </SetupStep>
            </ClientSetupTab>
            <ClientSetupTab label="claude-code">
              <SetupStep title="Instalacja">
                Wklej komendę w terminalu. Claude Code doda Testownik jako
                zdalny serwer MCP.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Komenda Claude Code"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={claudeCodeCommand}
              />
            </ClientSetupTab>
            <ClientSetupTab label="claude-desktop">
              <SetupStep title="Konfiguracja">
                W Claude Desktop otwórz &quot;Customize&quot;, przejdź do
                &quot;Connectors&quot;, wybierz &quot;Add custom connector&quot;
                i wklej poniższy adres.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Connector URL"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={mcpEndpoint}
              />
            </ClientSetupTab>
            <ClientSetupTab label="vscode">
              <SetupStep title="Instalacja z VS Code">
                Aby zainstalować MCP wybierz &quot;MCP: Add Server&quot; z
                Command Palette, kliknij &quot;HTTP&quot; i wklej poniższy
                adres.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="MCP Endpoint"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={mcpEndpoint}
              />
            </ClientSetupTab>
          </Tabs>
          <p className="text-muted-foreground text-sm">
            Po instalacji klient MCP poprosi Cię o zalogowanie do Testownika.
            Połączone aplikacje możesz później odłączyć w zakładce Integracje.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
