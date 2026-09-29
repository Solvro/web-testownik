import type { UserData } from "@testownik/core/user/types";
import { getProfileAvatarOptions } from "@testownik/core/user/avatars";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Platform, Pressable, Text, View } from "react-native";
import { Collection, CollectionDivider } from "../src/components/Collection";
import CollectionRow from "../src/components/native/CollectionRow";
import { Button, Screen, notify } from "../src/components/ui";
import { haptics } from "../src/lib/haptics";
import { userError } from "../src/lib/user-error";
import { api } from "../src/lib/api";
import { pickImage } from "../src/lib/files";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";

export default function Photo() {
  const session = useSession();
  const mounted = useRef(true);
  // Blocks a second tap before the disabled state renders.
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { t } = useLocale();
  const c = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [gravatar, setGravatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const email = session.user?.email;
  useEffect(() => {
    let active = true;
    if (email)
      void Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        email.trim().toLowerCase(),
      ).then((hash) => {
        if (active)
          setGravatar(
            `https://gravatar.com/avatar/${hash}?s=256&d=identicon&r=g`,
          );
      });
    return () => {
      active = false;
    };
  }, [email]);
  const options = getProfileAvatarOptions(session.user?.full_name ?? "", null);
  if (gravatar) options[options.length - 1] = gravatar;
  async function finish(action: () => Promise<UserData>) {
    setSaving(true);
    try {
      const user = await action();
      await session.reload(user);
      if (mounted.current) router.back();
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  async function saveAvatar() {
    if (!selected) return;
    await finish(async () => {
      const body = new FormData();
      let temporary: string | undefined;
      try {
        if (Platform.OS === "web") {
          const response = await fetch(selected);
          if (!response.ok)
            throw new Error(
              t("Nie udało się pobrać awatara.", "Could not load this avatar."),
            );
          body.append("photo", await response.blob(), "avatar.png");
        } else {
          temporary = `${FileSystem.cacheDirectory}avatar-${Crypto.randomUUID()}.png`;
          const result = await FileSystem.downloadAsync(selected, temporary);
          if (result.status !== 200)
            throw new Error(
              t("Nie udało się pobrać awatara.", "Could not load this avatar."),
            );
          body.append("photo", new File(result.uri));
        }
        return await api.request<UserData>("user/photo/", {
          method: "POST",
          body,
        });
      } finally {
        if (temporary)
          await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(
            () => undefined,
          );
      }
    });
  }
  const photo = selected ?? session.user?.photo;
  // Stack.Toolbar drops SF-symbol and text-only items on Android; use the JS controls.
  const native = Platform.OS === "ios";
  const run = (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    void action()
      .catch((error: unknown) => {
        haptics.error();
        notify(
          t("Nie zmieniono zdjęcia", "Couldn’t Update Photo"),
          userError(error, t),
        );
      })
      .finally(() => {
        busy.current = false;
      });
  };
  const chooseFromLibrary = async () => {
    setSaving(true);
    try {
      const result = await pickImage<UserData>("user/photo/", "photo");
      if (result) {
        await session.reload(result);
        haptics.success();
        if (mounted.current) router.back();
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  const removePhoto = () =>
    finish(() => api.request<UserData>("user/photo/", { method: "DELETE" }));
  return (
    <Screen
      footer={
        native ? undefined : (
          <Button disabled={!selected || saving} onPress={saveAvatar}>
            {t("Zapisz zdjęcie", "Save Photo")}
          </Button>
        )
      }
    >
      <Stack.Screen options={{ gestureEnabled: !selected }} />
      {native ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={() => router.back()}>
              {t("Anuluj", "Cancel")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              variant="prominent"
              tintColor={c.prominent}
              disabled={!selected || saving}
              onPress={() => run(saveAvatar)}
            >
              {t("Zapisz", "Save")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        </>
      ) : null}
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <View
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            backgroundColor: c.fill,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {photo ? (
            <Image
              accessibilityLabel={t("Podgląd zdjęcia", "Photo preview")}
              source={{ uri: photo }}
              style={{ width: 112, height: 112 }}
            />
          ) : (
            <Text style={{ fontSize: 44, color: c.primary }}>
              {session.user?.full_name?.[0] ?? "T"}
            </Text>
          )}
        </View>
      </View>
      <Collection>
        <CollectionRow
          title={t("Wybierz z Galerii", "Choose from Photos")}
          symbol="photo.on.rectangle"
          ionicon="images-outline"
          disclosure={false}
          disabled={saving}
          onPress={() => run(chooseFromLibrary)}
        />
        {session.user?.has_custom_photo ? (
          <>
            <CollectionDivider />
            <CollectionRow
              title={t("Usuń własne zdjęcie", "Remove Photo")}
              symbol="trash"
              ionicon="trash-outline"
              disclosure={false}
              disabled={saving}
              onPress={() => run(removePhoto)}
            />
          </>
        ) : null}
      </Collection>
      <Text
        accessibilityRole="header"
        style={{
          color: c.muted,
          fontSize: 17,
          fontWeight: "600",
          paddingHorizontal: 16,
          paddingTop: 20,
          // Material 3 list subheader.
          ...(Platform.OS === "android"
            ? { color: c.primary, fontSize: 14, fontWeight: "500" as const }
            : null),
        }}
      >
        {t("Awatary", "Avatars")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "center",
          paddingVertical: 12,
          backgroundColor: c.surface,
          borderRadius: 14,
          borderCurve: "continuous",
        }}
      >
        {options.map((url, index) => (
          <Pressable
            key={url}
            accessibilityRole="radio"
            accessibilityLabel={
              url === gravatar
                ? "Gravatar"
                : `${t("Awatar", "Avatar")} ${index + 1}`
            }
            accessibilityState={{
              checked: selected === url,
              disabled: saving,
            }}
            disabled={saving}
            onPress={() => {
              haptics.selection();
              setSelected(url);
            }}
            style={({ pressed }) => ({
              borderRadius: 40,
              padding: 3,
              borderWidth: 2.5,
              borderColor: selected === url ? c.primary : "transparent",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Image
              source={{ uri: url }}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: c.fill,
              }}
            />
          </Pressable>
        ))}
      </View>
      {/* Android's app bar back arrow already cancels. */}
      {native || Platform.OS === "android" ? null : (
        <Button
          kind="secondary"
          disabled={saving}
          onPress={() => router.back()}
        >
          {t("Anuluj", "Cancel")}
        </Button>
      )}
    </Screen>
  );
}
