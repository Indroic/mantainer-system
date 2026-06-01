class MachineNotFoundException(Exception):
    def __init__(self, machine_id: str) -> None:
        super().__init__(f"No se encontró la máquina con ID '{machine_id}'.")


class MachineIsReadOnlyException(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(
            f"La máquina con código '{code}' está DADA_DE_BAJA y se encuentra en estado de solo lectura."
        )


class MachineInvalidHorometerException(Exception):
    def __init__(self, current_val: float, new_val: float) -> None:
        super().__init__(
            f"Error de horómetro: La actualización de horómetro debe ser incremental. "
            f"El valor actual es {current_val} horas e intentó ingresar {new_val} horas."
        )
