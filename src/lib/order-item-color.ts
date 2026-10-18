export function isMissingOrderItemSelectedColorColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("selected_color")
    && (
      error.code === "42703"
      || error.code === "PGRST204"
      || (
        message.includes("column")
        && (
          message.includes("does not exist")
          || message.includes("could not find")
          || message.includes("schema cache")
        )
      )
    );
}
