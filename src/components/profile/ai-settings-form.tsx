import { BotIcon, CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { AccountLevelBadge } from "@/components/account-level-badge";
import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import { useAIModels } from "@/hooks/use-ai-models";
import {
  getAiModelMetadata,
  getAiModelOptions,
  resolvePreferredAiModel,
} from "@/lib/ai/models";
import { PermissionAction } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { AccountLevel, SettingsFormProps } from "@/types/user";
import { ACCOUNT_LEVEL } from "@/types/user";

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
  { label: "ChatGPT Desktop", value: "chatgpt-desktop" },
  { label: "Codex CLI", value: "codex-cli" },
  { label: "Claude Code", value: "claude-code" },
  { label: "Claude Desktop", value: "claude-desktop" },
  { label: "VS Code", value: "vscode" },
] as const;
const SYSTEM_DEFAULT_MODEL = "__system_default__";

function ClientSetupTab({ children, label }: ClientSetupTabProps) {
  return (
    <TabsContent value={label} className="flex flex-col gap-2">
      {children}
    </TabsContent>
  );
}

function DefaultModelSettingDetails({
  accountLevel,
}: {
  accountLevel: AccountLevel;
}) {
  return (
    <div className="min-w-0">
      <Label
        className="flex items-center gap-2 text-sm font-medium"
        htmlFor="default-ai-model"
      >
        Model startowy AI
        <AccountLevelBadge accountLevel={accountLevel} />
      </Label>
      <p className="text-muted-foreground text-xs">
        Domyślny systemu automatycznie śledzi ustawienie administratora. W
        czacie możesz zmienić model tymczasowo.
      </p>
    </div>
  );
}

function DefaultModelSettingLoading({
  accountLevel,
}: {
  accountLevel: AccountLevel;
}) {
  return (
    <div
      role="status"
      aria-label="Ładowanie dostępnych modeli AI"
      className="flex flex-col gap-3 md:flex-row md:items-center"
    >
      <DefaultModelSettingDetails accountLevel={accountLevel} />
      <div
        aria-hidden="true"
        className="border-input bg-muted/20 flex h-10 w-full shrink-0 items-center gap-2 rounded-md border px-3 md:ml-auto md:w-56"
      >
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-28 max-w-[70%]" />
      </div>
    </div>
  );
}

export function AiSettingsForm({
  settings,
  disabled = false,
  onSettingChange,
}: SettingsFormProps) {
  const { checkPermission, user } = useContext(AppContext);
  const hasAiAccess = checkPermission(PermissionAction.AI_FEATURES);
  const aiModelsQuery = useAIModels(hasAiAccess);
  const { data: aiModels } = aiModelsQuery;
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("general");

  const availableModels = aiModels?.models ?? [];
  const canSetDefaultAiModel =
    user?.account_level === ACCOUNT_LEVEL.SILVER ||
    user?.account_level === ACCOUNT_LEVEL.GOLD;
  const canSelectAiModel =
    hasAiAccess && canSetDefaultAiModel && availableModels.length > 1;
  const aiModelOptions = getAiModelOptions(availableModels);
  const systemDefaultModel = getAiModelMetadata(
    availableModels,
    aiModels?.default_model,
  );
  const selectedAiModel = resolvePreferredAiModel(
    settings.default_ai_model,
    availableModels,
    aiModels?.default_model ?? null,
  );
  const selectedAiModelOption =
    selectedAiModel === null
      ? null
      : getAiModelMetadata(availableModels, selectedAiModel);
  const modelPreferenceOptions = [
    {
      value: SYSTEM_DEFAULT_MODEL,
      label:
        systemDefaultModel === null
          ? "Domyślny"
          : `Domyślny · ${systemDefaultModel.label}`,
    },
    ...aiModelOptions,
  ];
  const mcpEndpoint = `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/mcp`;
  const claudeCodeCommand = `claude mcp add --transport http testownik ${mcpEndpoint}`;
  const codexCliAddCommand = `codex mcp add testownik --url ${mcpEndpoint}`;
  const codexCliLoginCommand = "codex mcp login testownik";

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
        {hasAiAccess && canSetDefaultAiModel && aiModelsQuery.isPending ? (
          <DefaultModelSettingLoading accountLevel={user.account_level} />
        ) : null}
        {hasAiAccess && aiModelsQuery.isError ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <p className="text-destructive text-sm">
              Nie udało się pobrać dostępnych modeli.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void aiModelsQuery.refetch()}
            >
              <RefreshCwIcon /> Spróbuj ponownie
            </Button>
          </div>
        ) : null}
        {aiModelsQuery.isSuccess &&
        canSelectAiModel &&
        selectedAiModel !== null &&
        selectedAiModelOption !== null ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <DefaultModelSettingDetails accountLevel={user.account_level} />
            <Select
              disabled={disabled}
              items={modelPreferenceOptions}
              value={settings.default_ai_model ?? SYSTEM_DEFAULT_MODEL}
              onValueChange={(value) => {
                if (value === SYSTEM_DEFAULT_MODEL) {
                  onSettingChange("default_ai_model", null);
                  return;
                }
                if (availableModels.some((model) => model.model === value)) {
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
                <SelectValue>
                  <AiModelProviderIcon
                    provider={selectedAiModelOption.provider}
                  />
                  <span className="truncate">
                    {settings.default_ai_model === null
                      ? `Domyślny · ${selectedAiModelOption.label}`
                      : selectedAiModelOption.label}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger
                className="w-full min-w-(--anchor-width)"
              >
                <SelectGroup>
                  <SelectItem
                    value={SYSTEM_DEFAULT_MODEL}
                    className="*:data-[slot=select-item-text]:gap-1.5"
                  >
                    {systemDefaultModel === null ? (
                      "Domyślny"
                    ) : (
                      <>
                        <AiModelProviderIcon
                          provider={systemDefaultModel.provider}
                          className="my-auto"
                        />
                        Domyślny · {systemDefaultModel.label}
                      </>
                    )}
                  </SelectItem>
                  {aiModelOptions.map((model) => (
                    <SelectItem
                      key={model.value}
                      value={model.value}
                      className="*:data-[slot=select-item-text]:gap-1.5"
                    >
                      <AiModelProviderIcon
                        provider={model.provider}
                        className="my-auto"
                      />
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
            <ClientSetupTab label="chatgpt-desktop">
              <SetupStep title="Dodaj serwer">
                W ChatGPT Desktop otwórz Settings → MCP servers, wybierz Add
                server, wpisz nazwę Testownik i wybierz Streamable HTTP.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Adres serwera"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={mcpEndpoint}
              />
              <SetupStep title="Połącz konto">
                Zapisz serwer, wybierz Restart, a następnie Authenticate, żeby
                zalogować się do Testownika. Jeśli serwer został już dodany w
                Codex CLI, wystarczy ponownie uruchomić aplikację.
              </SetupStep>
            </ClientSetupTab>
            <ClientSetupTab label="codex-cli">
              <SetupStep title="Dodaj serwer">
                Uruchom polecenie w terminalu. Codex zapisze zdalny serwer MCP
                we współdzielonej konfiguracji.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Dodaj Testownik"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={codexCliAddCommand}
              />
              <SetupStep title="Zaloguj się">
                Uruchom drugie polecenie i dokończ logowanie w przeglądarce.
              </SetupStep>
              <CopyableSnippet
                copiedKey={copiedCommand}
                label="Połącz konto"
                onCopy={(value, key) => {
                  void copyCommand(value, key);
                }}
                value={codexCliLoginCommand}
              />
              <SetupStep title="Sprawdź połączenie">
                Użyj <code className="text-foreground">codex mcp list</code> w
                terminalu albo <code className="text-foreground">/mcp</code> w
                interfejsie Codex, żeby zobaczyć aktywne serwery.
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
