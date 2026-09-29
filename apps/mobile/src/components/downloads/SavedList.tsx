import { Fragment } from "react";

import { Collection, CollectionDivider } from "../Collection";
import CollectionRow from "../native/CollectionRow";
import { Label, Screen } from "../ui";
import type { SavedListProps } from "./types";

export default function SavedList({
  title,
  help,
  items,
  open,
}: SavedListProps) {
  return (
    <Screen>
      {title}
      <Label muted>{help}</Label>
      <Collection>
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index ? <CollectionDivider /> : null}
            <CollectionRow
              kind="offline"
              title={item.title}
              detail={item.detail}
              onPress={() => open(item.id)}
            />
          </Fragment>
        ))}
      </Collection>
    </Screen>
  );
}
