class MachineTypeNotFoundException(Exception):
    def __init__(self, machine_type_id: str) -> None:
        super().__init__(f"No se encontró el tipo de maquinaria con ID '{machine_type_id}'.")


class MachineTypeAlreadyExistsException(Exception):
    def __init__(self, name: str) -> None:
        super().__init__(f"Ya existe un tipo de maquinaria con el nombre '{name}'.")
