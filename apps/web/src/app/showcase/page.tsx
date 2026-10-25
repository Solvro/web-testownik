/* This page is for fun, do whatever you want with it! Ideally it should show all components in all variants and sizes, but it's up to you how you want to organize it. */

"use client";
/* eslint-disable unicorn/no-abusive-eslint-disable, eslint-comments/no-unlimited-disable */
/* eslint-disable */
import {
  AlertCircleIcon,
  BellIcon,
  BoldIcon,
  BookOpenIcon,
  CalendarIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  ItalicIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
  StarIcon,
  Trash2Icon,
  UnderlineIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

export default function ShowcasePage() {
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [radioValue, setRadioValue] = useState("option-1");
  const [sliderValue, setSliderValue] = useState([50]);
  const [rangeValue, setRangeValue] = useState([25, 75]);
  const [dropdownCheckbox1, setDropdownCheckbox1] = useState(true);
  const [dropdownCheckbox2, setDropdownCheckbox2] = useState(false);
  const [dropdownRadio, setDropdownRadio] = useState("option-1");

  // @ts-ignore
  // @ts-ignore
  return (
    <TooltipProvider>
      <div className="space-y-16 py-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Component Showcase
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            All UI components in every variant, size, and configuration.
          </p>
        </div>

        {/* ── Button ── */}
        <Section title="Button">
          <SubSection title="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="default">Default</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
          </SubSection>

          <SubSection title="Sizes">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <PlusIcon />
              </Button>
              <Button size="icon-xs">
                <PlusIcon />
              </Button>
              <Button size="icon-sm">
                <PlusIcon />
              </Button>
              <Button size="icon-lg">
                <PlusIcon />
              </Button>
            </div>
          </SubSection>

          <SubSection title="With Icons">
            <div className="flex flex-wrap items-center gap-3">
              <Button>
                <MailIcon data-icon="inline-start" />
                Login with Email
              </Button>
              <Button variant="outline">
                <DownloadIcon data-icon="inline-start" />
                Download
              </Button>
              <Button variant="secondary">
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
              <Button variant="ghost">
                <SettingsIcon data-icon="inline-start" />
                Settings
              </Button>
            </div>
          </SubSection>

          <SubSection title="Disabled">
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Default</Button>
              <Button variant="outline" disabled>
                Outline
              </Button>
              <Button variant="secondary" disabled>
                Secondary
              </Button>
              <Button variant="ghost" disabled>
                Ghost
              </Button>
              <Button variant="destructive" disabled>
                Destructive
              </Button>
              <Button variant="link" disabled>
                Link
              </Button>
            </div>
          </SubSection>

          <SubSection title="All Variant x Size Combinations">
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="text-muted-foreground pr-4 pb-2 text-left font-medium">
                      Variant / Size
                    </th>
                    {(
                      [
                        "xs",
                        "sm",
                        "default",
                        "lg",
                        "icon",
                        "icon-xs",
                        "icon-sm",
                        "icon-lg",
                      ] as const
                    ).map((size) => (
                      <th
                        key={size}
                        className="text-muted-foreground px-2 pb-2 text-left font-medium"
                      >
                        {size}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      "default",
                      "outline",
                      "secondary",
                      "ghost",
                      "destructive",
                      "link",
                    ] as const
                  ).map((variant) => (
                    <tr key={variant}>
                      <td className="text-muted-foreground py-1.5 pr-4">
                        {variant}
                      </td>
                      {(
                        [
                          "xs",
                          "sm",
                          "default",
                          "lg",
                          "icon",
                          "icon-xs",
                          "icon-sm",
                          "icon-lg",
                        ] as const
                      ).map((size) => (
                        <td key={size} className="px-2 py-1.5">
                          <Button variant={variant} size={size}>
                            {size.startsWith("icon") ? <StarIcon /> : "Btn"}
                          </Button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SubSection>
        </Section>

        {/* ── Badge ── */}
        <Section title="Badge">
          <SubSection title="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="ghost">Ghost</Badge>
              <Badge variant="link">Link</Badge>
            </div>
          </SubSection>

          <SubSection title="With Icons">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">
                <StarIcon data-icon="inline-start" />
                Featured
              </Badge>
              <Badge variant="secondary">
                <InfoIcon data-icon="inline-start" />
                Info
              </Badge>
              <Badge variant="destructive">
                <AlertCircleIcon data-icon="inline-start" />
                Error
              </Badge>
              <Badge variant="outline">
                <BellIcon data-icon="inline-start" />
                Notification
              </Badge>
            </div>
          </SubSection>
        </Section>

        {/* ── Alert ── */}
        <Section title="Alert">
          <SubSection title="Default Variant">
            <Alert>
              <InfoIcon />
              <AlertTitle>Heads up!</AlertTitle>
              <AlertDescription>
                You can add components to your app using the CLI.
              </AlertDescription>
            </Alert>
          </SubSection>

          <SubSection title="Destructive Variant">
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Your session has expired. Please log in again.
              </AlertDescription>
            </Alert>
          </SubSection>

          <SubSection title="With Action">
            <Alert>
              <InfoIcon />
              <AlertTitle>New update available</AlertTitle>
              <AlertDescription>
                A new version is ready to install.
              </AlertDescription>
              <AlertAction>
                <Button size="xs" variant="outline">
                  Update
                </Button>
              </AlertAction>
            </Alert>
          </SubSection>

          <SubSection title="Without Icon">
            <Alert>
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                This is a simple alert without an icon.
              </AlertDescription>
            </Alert>
          </SubSection>
        </Section>

        {/* ── Toggle ── */}
        <Section title="Toggle">
          <SubSection title="Variants">
            <div className="flex flex-wrap items-center gap-3">
              <Toggle variant="default" aria-label="Toggle default">
                <BoldIcon />
              </Toggle>
              <Toggle variant="outline" aria-label="Toggle outline">
                <ItalicIcon />
              </Toggle>
            </div>
          </SubSection>

          <SubSection title="Sizes">
            <div className="flex flex-wrap items-center gap-3">
              <Toggle size="sm" aria-label="Toggle sm">
                <BoldIcon />
                Small
              </Toggle>
              <Toggle size="default" aria-label="Toggle default">
                <BoldIcon />
                Default
              </Toggle>
              <Toggle size="lg" aria-label="Toggle lg">
                <BoldIcon />
                Large
              </Toggle>
            </div>
          </SubSection>

          <SubSection title="All Variant x Size Combinations">
            <div className="flex flex-wrap items-center gap-3">
              {(["default", "outline"] as const).map((variant) =>
                (["sm", "default", "lg"] as const).map((size) => (
                  <Toggle
                    key={`${variant}-${size}`}
                    variant={variant}
                    size={size}
                    aria-label={`Toggle ${variant} ${size}`}
                  >
                    <UnderlineIcon />
                  </Toggle>
                )),
              )}
            </div>
          </SubSection>

          <SubSection title="Disabled">
            <div className="flex flex-wrap items-center gap-3">
              <Toggle disabled aria-label="Toggle disabled">
                <BoldIcon />
              </Toggle>
              <Toggle variant="outline" disabled aria-label="Toggle disabled">
                <ItalicIcon />
              </Toggle>
            </div>
          </SubSection>
        </Section>

        {/* ── Card ── */}
        <Section title="Card">
          <div className="grid gap-6 md:grid-cols-2">
            <SubSection title="Default Size">
              <Card>
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description goes here.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Card content with some text.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>
            </SubSection>

            <SubSection title="Gradient">
              <Card variant="gradient">
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description goes here.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Card content with some text.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>
            </SubSection>

            <SubSection title="Small Size">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Small Card</CardTitle>
                  <CardDescription>
                    Compact card with smaller padding.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Small card content.</p>
                </CardContent>
                <CardFooter>
                  <Button size="xs">Action</Button>
                </CardFooter>
              </Card>
            </SubSection>

            <SubSection title="With Action">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage your notifications.</CardDescription>
                  <CardAction>
                    <Button variant="outline" size="sm">
                      <SettingsIcon data-icon="inline-start" />
                      Settings
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p>You have 3 unread messages.</p>
                </CardContent>
              </Card>
            </SubSection>

            <SubSection title="Card Only Header">
              <Card>
                <CardHeader>
                  <CardTitle>Simple Card</CardTitle>
                  <CardDescription>
                    A card with only a header section.
                  </CardDescription>
                </CardHeader>
              </Card>
            </SubSection>
          </div>
        </Section>

        {/* ── Input ── */}
        <Section title="Input">
          <div className="grid max-w-md gap-4">
            <SubSection title="Default">
              <Input placeholder="Type something..." />
            </SubSection>
            <SubSection title="With Label">
              <div className="grid gap-2">
                <Label htmlFor="email-input">Email</Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="your@email.com"
                />
              </div>
            </SubSection>
            <SubSection title="Disabled">
              <Input placeholder="Disabled input" disabled />
            </SubSection>
            <SubSection title="Invalid">
              <Input
                placeholder="Invalid input"
                aria-invalid="true"
                defaultValue="bad value"
              />
            </SubSection>
            <SubSection title="File Input">
              <Input type="file" />
            </SubSection>
          </div>
        </Section>

        {/* ── Textarea ── */}
        <Section title="Textarea">
          <div className="grid max-w-md gap-4">
            <SubSection title="Default">
              <Textarea placeholder="Type your message here..." />
            </SubSection>
            <SubSection title="With Label">
              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell us about yourself..." />
              </div>
            </SubSection>
            <SubSection title="Disabled">
              <Textarea placeholder="Disabled textarea" disabled />
            </SubSection>
            <SubSection title="Invalid">
              <Textarea
                placeholder="Invalid textarea"
                aria-invalid="true"
                defaultValue="bad value"
              />
            </SubSection>
          </div>
        </Section>

        {/* ── Input Group ── */}
        <Section title="Input Group">
          <div className="grid max-w-md gap-4">
            <SubSection title="With Inline Start Addon (Icon)">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search..." />
              </InputGroup>
            </SubSection>

            <SubSection title="With Inline End Addon (Text)">
              <InputGroup>
                <InputGroupInput placeholder="0.00" />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>USD</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </SubSection>

            <SubSection title="With Both Addons">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <MailIcon />
                </InputGroupAddon>
                <InputGroupInput placeholder="email@example.com" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs">
                    <CopyIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </SubSection>

            <SubSection title="With Block Start Addon">
              <InputGroup>
                <InputGroupAddon align="block-start" className="border-b">
                  <InputGroupText>Title</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput placeholder="Enter title..." />
              </InputGroup>
            </SubSection>

            <SubSection title="With Textarea">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <FileIcon />
                </InputGroupAddon>
                <InputGroupTextarea placeholder="Write a message..." />
              </InputGroup>
            </SubSection>

            <SubSection title="Button Sizes in Group">
              <div className="space-y-3">
                <InputGroup>
                  <InputGroupInput placeholder="xs button" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="xs">Go</InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <InputGroup>
                  <InputGroupInput placeholder="sm button" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="sm">Submit</InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <InputGroup>
                  <InputGroupInput placeholder="icon-xs button" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs">
                      <SearchIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <InputGroup>
                  <InputGroupInput placeholder="icon-sm button" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-sm">
                      <SearchIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── Label ── */}
        <Section title="Label">
          <div className="flex flex-wrap items-center gap-6">
            <Label>Default Label</Label>
            <div data-disabled="true" className="group">
              <Label>Disabled Label</Label>
            </div>
          </div>
        </Section>

        {/* ── Checkbox ── */}
        <Section title="Checkbox">
          <div className="flex flex-wrap items-start gap-6">
            <SubSection title="Unchecked">
              <div className="flex items-center gap-2">
                <Checkbox id="cb-unchecked" />
                <Label htmlFor="cb-unchecked">Unchecked</Label>
              </div>
            </SubSection>
            <SubSection title="Checked">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cb-checked"
                  checked={checkboxChecked}
                  onCheckedChange={setCheckboxChecked}
                />
                <Label htmlFor="cb-checked">Checked</Label>
              </div>
            </SubSection>
            <SubSection title="Disabled">
              <div className="flex items-center gap-2">
                <Checkbox id="cb-disabled" disabled />
                <Label htmlFor="cb-disabled">Disabled</Label>
              </div>
            </SubSection>
            <SubSection title="Invalid">
              <div className="flex items-center gap-2">
                <Checkbox id="cb-invalid" aria-invalid="true" />
                <Label htmlFor="cb-invalid">Invalid</Label>
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── Radio Group ── */}
        <Section title="Radio Group">
          <div className="max-w-xs">
            <RadioGroup value={radioValue} onValueChange={setRadioValue}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-1" id="r1" />
                <Label htmlFor="r1">Option One</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-2" id="r2" />
                <Label htmlFor="r2">Option Two</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-3" id="r3" />
                <Label htmlFor="r3">Option Three</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="option-disabled" id="r4" disabled />
                <Label htmlFor="r4">Disabled</Label>
              </div>
            </RadioGroup>
          </div>
        </Section>

        {/* ── Switch ── */}
        <Section title="Switch">
          <div className="flex flex-wrap items-start gap-8">
            <SubSection title="Default Size">
              <div className="flex items-center gap-2">
                <Switch
                  id="sw-default"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <Label htmlFor="sw-default">Default</Label>
              </div>
            </SubSection>
            <SubSection title="Small Size">
              <div className="flex items-center gap-2">
                <Switch id="sw-sm" size="sm" defaultChecked />
                <Label htmlFor="sw-sm">Small</Label>
              </div>
            </SubSection>
            <SubSection title="Unchecked">
              <div className="flex items-center gap-2">
                <Switch id="sw-off" />
                <Label htmlFor="sw-off">Off</Label>
              </div>
            </SubSection>
            <SubSection title="Disabled">
              <div className="flex items-center gap-2">
                <Switch id="sw-disabled" disabled />
                <Label htmlFor="sw-disabled">Disabled</Label>
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── Select ── */}
        <Section title="Select">
          <div className="flex flex-wrap items-start gap-6">
            <SubSection title="Default Size">
              <Select defaultValue="apple">
                <SelectTrigger>
                  <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="cherry">Cherry</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Vegetables</SelectLabel>
                    <SelectItem value="carrot">Carrot</SelectItem>
                    <SelectItem value="celery">Celery</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </SubSection>

            <SubSection title="Small Size">
              <Select>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Small select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Option 1</SelectItem>
                  <SelectItem value="2">Option 2</SelectItem>
                  <SelectItem value="3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </SubSection>

            <SubSection title="With Disabled Items">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled" disabled>
                    Disabled
                  </SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </SubSection>
          </div>
        </Section>

        {/* ── Tabs ── */}
        <Section title="Tabs">
          <SubSection title="Default Variant - Horizontal">
            <Tabs defaultValue="tab-1">
              <TabsList>
                <TabsTrigger value="tab-1">Account</TabsTrigger>
                <TabsTrigger value="tab-2">Password</TabsTrigger>
                <TabsTrigger value="tab-3">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="tab-1">
                <p className="text-muted-foreground p-4">
                  Account settings content.
                </p>
              </TabsContent>
              <TabsContent value="tab-2">
                <p className="text-muted-foreground p-4">
                  Password settings content.
                </p>
              </TabsContent>
              <TabsContent value="tab-3">
                <p className="text-muted-foreground p-4">
                  General settings content.
                </p>
              </TabsContent>
            </Tabs>
          </SubSection>

          <SubSection title="Line Variant - Horizontal">
            <Tabs defaultValue="tab-1">
              <TabsList variant="line">
                <TabsTrigger value="tab-1">Overview</TabsTrigger>
                <TabsTrigger value="tab-2">Analytics</TabsTrigger>
                <TabsTrigger value="tab-3">Reports</TabsTrigger>
                <TabsTrigger value="tab-4" disabled>
                  Disabled
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tab-1">
                <p className="text-muted-foreground p-4">Overview content.</p>
              </TabsContent>
              <TabsContent value="tab-2">
                <p className="text-muted-foreground p-4">Analytics content.</p>
              </TabsContent>
              <TabsContent value="tab-3">
                <p className="text-muted-foreground p-4">Reports content.</p>
              </TabsContent>
            </Tabs>
          </SubSection>

          <SubSection title="Default Variant - Vertical">
            <Tabs defaultValue="tab-1" orientation="vertical">
              <TabsList>
                <TabsTrigger value="tab-1">General</TabsTrigger>
                <TabsTrigger value="tab-2">Security</TabsTrigger>
                <TabsTrigger value="tab-3">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="tab-1">
                <p className="text-muted-foreground p-4">General content.</p>
              </TabsContent>
              <TabsContent value="tab-2">
                <p className="text-muted-foreground p-4">Security content.</p>
              </TabsContent>
              <TabsContent value="tab-3">
                <p className="text-muted-foreground p-4">Billing content.</p>
              </TabsContent>
            </Tabs>
          </SubSection>

          <SubSection title="Line Variant - Vertical">
            <Tabs defaultValue="tab-1" orientation="vertical">
              <TabsList variant="line">
                <TabsTrigger value="tab-1">Profile</TabsTrigger>
                <TabsTrigger value="tab-2">Preferences</TabsTrigger>
                <TabsTrigger value="tab-3">Notifications</TabsTrigger>
              </TabsList>
              <TabsContent value="tab-1">
                <p className="text-muted-foreground p-4">Profile content.</p>
              </TabsContent>
              <TabsContent value="tab-2">
                <p className="text-muted-foreground p-4">
                  Preferences content.
                </p>
              </TabsContent>
              <TabsContent value="tab-3">
                <p className="text-muted-foreground p-4">
                  Notifications content.
                </p>
              </TabsContent>
            </Tabs>
          </SubSection>
        </Section>

        {/* ── Avatar ── */}
        <Section title="Avatar">
          <SubSection title="Sizes with Image">
            <div className="flex items-center gap-4">
              <Avatar size="sm">
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>SM</AvatarFallback>
              </Avatar>
              <Avatar size="default">
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>DF</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>LG</AvatarFallback>
              </Avatar>
            </div>
          </SubSection>

          <SubSection title="Sizes with Fallback">
            <div className="flex items-center gap-4">
              <Avatar size="sm">
                <AvatarFallback>SM</AvatarFallback>
              </Avatar>
              <Avatar size="default">
                <AvatarFallback>DF</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarFallback>LG</AvatarFallback>
              </Avatar>
            </div>
          </SubSection>

          <SubSection title="With Badge">
            <div className="flex items-center gap-4">
              <Avatar size="sm">
                <AvatarFallback>SM</AvatarFallback>
                <AvatarBadge />
              </Avatar>
              <Avatar size="default">
                <AvatarFallback>DF</AvatarFallback>
                <AvatarBadge />
              </Avatar>
              <Avatar size="lg">
                <AvatarFallback>LG</AvatarFallback>
                <AvatarBadge />
              </Avatar>
            </div>
          </SubSection>

          <SubSection title="Avatar Group">
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>B</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>C</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>D</AvatarFallback>
              </Avatar>
              <AvatarGroupCount>+3</AvatarGroupCount>
            </AvatarGroup>
          </SubSection>
        </Section>

        {/* ── Progress ── */}
        <Section title="Progress">
          <div className="grid max-w-md gap-6">
            <SubSection title="Various Values">
              <div className="space-y-4">
                <Progress value={0} />
                <Progress value={25} />
                <Progress value={50} />
                <Progress value={75} />
                <Progress value={100} />
              </div>
            </SubSection>

            <SubSection title="Indeterminate (null)">
              <Progress value={null} />
            </SubSection>
          </div>
        </Section>

        {/* ── Slider ── */}
        <Section title="Slider">
          <div className="grid max-w-md gap-6">
            <SubSection title="Single Value">
              {/* @ts-ignore */}
              <Slider value={sliderValue} onValueChange={setSliderValue} />
            </SubSection>

            <SubSection title="Range">
              {/* @ts-ignore */}
              <Slider value={rangeValue} onValueChange={setRangeValue} />
            </SubSection>

            <SubSection title="Disabled">
              <Slider defaultValue={[30]} disabled />
            </SubSection>

            <SubSection title="Custom Min/Max/Step">
              <Slider defaultValue={[3]} min={0} max={10} largeStep={2} />
            </SubSection>
          </div>

          <SubSection title="Vertical">
            <div className="flex items-end gap-8">
              <Slider
                defaultValue={[30]}
                orientation="vertical"
                className="h-40"
              />
              <Slider
                defaultValue={[20, 70]}
                orientation="vertical"
                className="h-40"
              />
            </div>
          </SubSection>
        </Section>

        {/* ── Skeleton ── */}
        <Section title="Skeleton">
          <div className="flex flex-col gap-4">
            <SubSection title="Various Shapes">
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </SubSection>
            <SubSection title="Card Skeleton">
              <div className="w-64 space-y-3">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── Spinner ── */}
        <Section title="Spinner">
          <div className="flex items-center gap-6">
            <SubSection title="Default">
              <Spinner />
            </SubSection>
            <SubSection title="Large">
              <Spinner className="size-8" />
            </SubSection>
            <SubSection title="Custom Color">
              <Spinner className="text-primary size-6" />
            </SubSection>
          </div>
        </Section>

        {/* ── Accordion ── */}
        <Section title="Accordion">
          <div className="max-w-lg">
            <Accordion>
              <AccordionItem>
                <AccordionTrigger>Is it accessible?</AccordionTrigger>
                <AccordionContent>
                  Yes. It adheres to the WAI-ARIA design pattern.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem>
                <AccordionTrigger>Is it styled?</AccordionTrigger>
                <AccordionContent>
                  Yes. It comes with default styles that match the other
                  components&apos; aesthetic.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem>
                <AccordionTrigger>Is it animated?</AccordionTrigger>
                <AccordionContent>
                  Yes. It&apos;s animated by default, but you can disable it if
                  you prefer.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Section>

        {/* ── Dialog ── */}
        <Section title="Dialog">
          <div className="flex flex-wrap gap-4">
            <SubSection title="With Close Button">
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>
                  Open Dialog
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog Title</DialogTitle>
                    <DialogDescription>
                      This is a dialog with a close button in the top right
                      corner.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SubSection>

            <SubSection title="Without Close Button">
              <Dialog>
                <DialogTrigger render={<Button variant="outline" />}>
                  No Close Button
                </DialogTrigger>
                <DialogContent showCloseButton={false}>
                  <DialogHeader>
                    <DialogTitle>Confirm Action</DialogTitle>
                    <DialogDescription>
                      This dialog has no close button.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter showCloseButton>
                    <Button>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SubSection>
          </div>
        </Section>

        {/* ── Alert Dialog ── */}
        <Section title="Alert Dialog">
          <div className="flex flex-wrap gap-4">
            <SubSection title="Default Size">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" />}>
                  Delete Item
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your item.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SubSection>

            <SubSection title="Small Size">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline" />}>
                  Small Alert
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No</AlertDialogCancel>
                    <AlertDialogAction>Yes</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SubSection>

            <SubSection title="With Media">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline" />}>
                  With Media
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <Trash2Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account and all
                      associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SubSection>
          </div>
        </Section>

        {/* ── Dropdown Menu ── */}
        <Section title="Dropdown Menu">
          <div className="flex flex-wrap gap-4">
            <SubSection title="Standard Items">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  Open Menu
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <UserIcon />
                      Profile
                      <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <SettingsIcon />
                      Settings
                      <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    <Trash2Icon />
                    Delete
                    <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SubSection>

            <SubSection title="Checkbox Items">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  Checkboxes
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={dropdownCheckbox1}
                    onCheckedChange={setDropdownCheckbox1}
                  >
                    Show Toolbar
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={dropdownCheckbox2}
                    onCheckedChange={setDropdownCheckbox2}
                  >
                    Show Sidebar
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SubSection>

            <SubSection title="Radio Items">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  Radio Group
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={dropdownRadio}
                    onValueChange={setDropdownRadio}
                  >
                    <DropdownMenuRadioItem value="option-1">
                      Name
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="option-2">
                      Date
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="option-3">
                      Size
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SubSection>
          </div>
        </Section>

        {/* ── Popover ── */}
        <Section title="Popover">
          <div className="flex flex-wrap gap-4">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>
                Open Popover
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>Dimensions</PopoverTitle>
                  <PopoverDescription>
                    Set the dimensions for the layer.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="pop-width">Width</Label>
                    <Input id="pop-width" defaultValue="100%" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pop-height">Height</Label>
                    <Input id="pop-height" defaultValue="25px" />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </Section>

        {/* ── Hover Card ── */}
        <Section title="Hover Card">
          <HoverCard>
            <HoverCardTrigger
              render={
                <a
                  href="#"
                  className="text-primary underline underline-offset-4"
                />
              }
            >
              @nextjs
            </HoverCardTrigger>
            <HoverCardContent>
              <div className="flex justify-between space-x-4">
                <Avatar>
                  <AvatarImage src="https://github.com/vercel.png" />
                  <AvatarFallback>VC</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">@nextjs</h4>
                  <p className="text-sm">
                    The React Framework, created and maintained by @vercel.
                  </p>
                  <div className="text-muted-foreground flex items-center pt-2 text-xs">
                    <CalendarIcon className="mr-2 size-4" />
                    Joined December 2021
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </Section>

        {/* ── Tooltip ── */}
        <Section title="Tooltip">
          <div className="flex flex-wrap items-center gap-6">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger render={<Button variant="outline" />}>
                  {side}
                </TooltipTrigger>
                <TooltipContent side={side}>
                  <p>Tooltip on {side}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </Section>

        {/* ── Table ── */}
        <Section title="Table">
          <Table>
            <TableCaption>A list of recent invoices.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-25">Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV001</TableCell>
                <TableCell>
                  <Badge variant="default">Paid</Badge>
                </TableCell>
                <TableCell>Credit Card</TableCell>
                <TableCell className="text-right">$250.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV002</TableCell>
                <TableCell>
                  <Badge variant="secondary">Pending</Badge>
                </TableCell>
                <TableCell>PayPal</TableCell>
                <TableCell className="text-right">$150.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">INV003</TableCell>
                <TableCell>
                  <Badge variant="destructive">Unpaid</Badge>
                </TableCell>
                <TableCell>Bank Transfer</TableCell>
                <TableCell className="text-right">$350.00</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">$750.00</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Section>

        {/* ── Input OTP ── */}
        <Section title="Input OTP">
          <div className="flex flex-col gap-6">
            <SubSection title="Single Group">
              <InputOTP maxLength={6}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </SubSection>

            <SubSection title="With Separator">
              <InputOTP maxLength={6}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </SubSection>
          </div>
        </Section>

        {/* ── Kbd ── */}
        <Section title="Kbd">
          <div className="flex flex-wrap items-center gap-4">
            <SubSection title="Single Keys">
              <div className="flex items-center gap-2">
                <Kbd>K</Kbd>
                <Kbd>Enter</Kbd>
                <Kbd>Shift</Kbd>
                <Kbd>Esc</Kbd>
              </div>
            </SubSection>
            <SubSection title="Key Group">
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>C</Kbd>
              </KbdGroup>
            </SubSection>
            <SubSection title="Platform-Aware Shortcut">
              <div className="flex items-center gap-4">
                <KbdShortcut suffix="K" />
                <KbdShortcut suffix="S" />
                <KbdShortcut suffix="Z" />
              </div>
            </SubSection>
          </div>
        </Section>

        {/* ── Scroll Area ── */}
        <Section title="Scroll Area">
          <div className="flex flex-wrap gap-6">
            <SubSection title="Vertical">
              <ScrollArea className="border-border h-48 w-64 rounded-md border p-4">
                <div className="space-y-4">
                  {Array.from({ length: 20 }, (_, index) => (
                    <div key={index} className="text-sm">
                      Item {index + 1} - Lorem ipsum dolor sit amet
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SubSection>
            <SubSection title="Horizontal">
              <ScrollArea className="border-border w-96 rounded-md border p-4">
                <div className="flex gap-4">
                  {Array.from({ length: 15 }, (_, index) => (
                    <div
                      key={index}
                      className="bg-muted flex size-24 shrink-0 items-center justify-center rounded-md"
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </SubSection>
          </div>
        </Section>

        {/* ── Aspect Ratio ── */}
        <Section title="Aspect Ratio">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { ratio: 16 / 9, label: "16:9" },
              { ratio: 4 / 3, label: "4:3" },
              { ratio: 1, label: "1:1" },
            ].map(({ ratio, label }) => (
              <SubSection key={label} title={label}>
                <AspectRatio ratio={ratio}>
                  <div className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-md">
                    {label}
                  </div>
                </AspectRatio>
              </SubSection>
            ))}
          </div>
        </Section>

        {/* ── Empty ── */}
        <Section title="Empty State">
          <div className="grid gap-6 md:grid-cols-2">
            <SubSection title="Default Media">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia>
                    <ImageIcon className="text-muted-foreground size-16" />
                  </EmptyMedia>
                  <EmptyTitle>No images found</EmptyTitle>
                  <EmptyDescription>
                    Upload your first image to get started.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button>
                    <PlusIcon data-icon="inline-start" />
                    Upload Image
                  </Button>
                </EmptyContent>
              </Empty>
            </SubSection>

            <SubSection title="Icon Media Variant">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <InboxIcon />
                  </EmptyMedia>
                  <EmptyTitle>No messages</EmptyTitle>
                  <EmptyDescription>
                    Your inbox is empty. New messages will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </SubSection>
          </div>
        </Section>

        {/* ── Toast (Sonner) ── */}
        <Section title="Toast (Sonner)">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => toast("Default toast message")}
            >
              Default
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Success!", {
                  description: "Your action was completed.",
                })
              }
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error("Error!", {
                  description: "Something went wrong.",
                })
              }
            >
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.warning("Warning!", {
                  description: "Please check your input.",
                })
              }
            >
              Warning
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.info("Info", {
                  description: "Here is some useful information.",
                })
              }
            >
              Info
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.promise(
                  new Promise((resolve) => setTimeout(resolve, 2000)),
                  {
                    loading: "Loading...",
                    success: "Done!",
                    error: "Failed!",
                  },
                )
              }
            >
              Promise
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast("Event created", {
                  description: "Monday, January 3rd at 6:00 PM",
                  action: {
                    label: "Undo",
                    onClick: () => toast("Undone!"),
                  },
                })
              }
            >
              With Action
            </Button>
          </div>
        </Section>

        {/* ── Navigation Menu ── */}
        <Section title="Navigation Menu">
          <p className="text-muted-foreground text-sm">
            The NavigationMenu component requires complex content composition.
            Below is a simple link-style navigation menu using the trigger
            style.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <BookOpenIcon data-icon="inline-start" />
              Documentation
            </Button>
            <Button variant="ghost" size="sm">
              <StarIcon data-icon="inline-start" />
              Components
            </Button>
            <Button variant="ghost" size="sm">
              <ShareIcon data-icon="inline-start" />
              Examples
            </Button>
          </div>
        </Section>

        {/* ── Combined Examples ── */}
        <Section title="Combined Examples">
          <SubSection title="Login Form">
            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Enter your credentials to sign in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <MailIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                    />
                  </InputGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter password"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" />
                    <Label htmlFor="remember">Remember me</Label>
                  </div>
                  <Button variant="link" size="sm">
                    Forgot password?
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Sign In</Button>
              </CardFooter>
            </Card>
          </SubSection>

          <SubSection title="Settings Panel">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Manage your notification settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-muted-foreground text-sm">
                      Receive emails about activity.
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-muted-foreground text-sm">
                      Receive push notifications.
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="grid gap-2">
                  <Label>Theme</Label>
                  <Select defaultValue="system">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline">Cancel</Button>
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>
          </SubSection>

          <SubSection title="Data Dashboard">
            <Card>
              <CardHeader>
                <CardTitle>User Statistics</CardTitle>
                <CardDescription>
                  Overview of user activity this month.
                </CardDescription>
                <CardAction>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="outline" size="icon-sm" />}
                    >
                      <DownloadIcon />
                    </TooltipTrigger>
                    <TooltipContent>Export Data</TooltipContent>
                  </Tooltip>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Total Users</p>
                    <p className="text-2xl font-bold">2,340</p>
                    <Badge variant="secondary">+12%</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                      Active Today
                    </p>
                    <p className="text-2xl font-bold">573</p>
                    <Badge variant="default">+5%</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Churn Rate</p>
                    <p className="text-2xl font-bold">2.4%</p>
                    <Badge variant="destructive">+0.3%</Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Progress value={73}>
                  <span className="text-muted-foreground text-sm">
                    Monthly target
                  </span>
                  <span className="text-muted-foreground ml-auto text-sm">
                    73%
                  </span>
                </Progress>
              </CardFooter>
            </Card>
          </SubSection>
        </Section>
      </div>
    </TooltipProvider>
  );
}
