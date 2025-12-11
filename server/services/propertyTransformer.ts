import type { NotionPropertyType } from "~~/types/mapping";

type PropertyValue = any;

export class PropertyTransformer {
  transform(
    type: NotionPropertyType,
    value: PropertyValue
  ): string | number | boolean {
    const transformer = this.getTransformer(type);
    return transformer(value);
  }

  private getTransformer(
    type: NotionPropertyType
  ): (value: PropertyValue) => string | number | boolean {
    const transformers: Record<
      NotionPropertyType,
      (v: PropertyValue) => string | number | boolean
    > = {
      title: this.transformTitle,
      rich_text: this.transformRichText,
      number: this.transformNumber,
      select: this.transformSelect,
      multi_select: this.transformMultiSelect,
      date: this.transformDate,
      people: this.transformPeople,
      files: this.transformFiles,
      checkbox: this.transformCheckbox,
      url: this.transformUrl,
      email: this.transformEmail,
      phone_number: this.transformPhoneNumber,
      formula: this.transformFormula,
      relation: this.transformRelation,
      rollup: this.transformRollup,
      created_time: this.transformCreatedTime,
      created_by: this.transformCreatedBy,
      last_edited_time: this.transformLastEditedTime,
      last_edited_by: this.transformLastEditedBy,
      status: this.transformStatus,
      unique_id: this.transformUniqueId,
    };

    return transformers[type] ?? (() => "");
  }

  private transformTitle(value: PropertyValue): string {
    return value?.title?.map((t: any) => t.plain_text).join("") ?? "";
  }

  private transformRichText(value: PropertyValue): string {
    return value?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
  }

  private transformNumber(value: PropertyValue): number {
    return value?.number ?? 0;
  }

  private transformSelect(value: PropertyValue): string {
    return value?.select?.name ?? "";
  }

  private transformMultiSelect(value: PropertyValue): string {
    return value?.multi_select?.map((o: any) => o.name).join(", ") ?? "";
  }

  private transformDate(value: PropertyValue): string {
    if (!value?.date) return "";
    const { start, end } = value.date;
    return end ? `${start} → ${end}` : start;
  }

  private transformPeople(value: PropertyValue): string {
    return value?.people?.map((p: any) => p.name ?? p.id).join(", ") ?? "";
  }

  private transformFiles(value: PropertyValue): string {
    return (
      value?.files
        ?.map((f: any) => f.file?.url ?? f.external?.url ?? "")
        .join(", ") ?? ""
    );
  }

  private transformCheckbox(value: PropertyValue): boolean {
    return value?.checkbox ?? false;
  }

  private transformUrl(value: PropertyValue): string {
    return value?.url ?? "";
  }

  private transformEmail(value: PropertyValue): string {
    return value?.email ?? "";
  }

  private transformPhoneNumber(value: PropertyValue): string {
    return value?.phone_number ?? "";
  }

  private transformFormula(value: PropertyValue): string | number | boolean {
    const formula = value?.formula;
    if (!formula) return "";

    switch (formula.type) {
      case "string":
        return formula.string ?? "";
      case "number":
        return formula.number ?? 0;
      case "boolean":
        return formula.boolean ?? false;
      case "date":
        return formula.date?.start ?? "";
      default:
        return "";
    }
  }

  private transformRelation(value: PropertyValue): string {
    return value?.relation?.map((r: any) => r.id).join(", ") ?? "";
  }

  private transformRollup(value: PropertyValue): string | number {
    const rollup = value?.rollup;
    if (!rollup) return "";

    switch (rollup.type) {
      case "number":
        return rollup.number ?? 0;
      case "date":
        return rollup.date?.start ?? "";
      case "array":
        return rollup.array?.length?.toString() ?? "0";
      default:
        return "";
    }
  }

  private transformCreatedTime(value: PropertyValue): string {
    return value?.created_time ?? "";
  }

  private transformCreatedBy(value: PropertyValue): string {
    return value?.created_by?.name ?? value?.created_by?.id ?? "";
  }

  private transformLastEditedTime(value: PropertyValue): string {
    return value?.last_edited_time ?? "";
  }

  private transformLastEditedBy(value: PropertyValue): string {
    return value?.last_edited_by?.name ?? value?.last_edited_by?.id ?? "";
  }

  private transformStatus(value: PropertyValue): string {
    return value?.status?.name ?? "";
  }

  private transformUniqueId(value: PropertyValue): string {
    const uid = value?.unique_id;
    if (!uid) return "";
    return uid.prefix ? `${uid.prefix}-${uid.number}` : String(uid.number);
  }
}

export const propertyTransformer = new PropertyTransformer();

