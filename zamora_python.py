import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import os

API_TOKEN = os.environ["API_BZZOIRO"]

LIGA = 3
TEMPORADA = 1307

HEADERS = {
    "Authorization": f"Token {API_TOKEN}",
    "Accept": "application/json"
}


def pedir(url):
    respuesta = requests.get(
        url,
        headers=HEADERS,
        timeout=20
    )

    if respuesta.status_code != 200:
        print(f"ERROR HTTP {respuesta.status_code}: {url}")
        return None

    return respuesta.json()


# ---------------------------------------------------------
# 1. OBTENER CLASIFICACIÓN
# ---------------------------------------------------------

inicio = time.time()

url_clasificacion = (
    f"https://sports.bzzoiro.com/api/v2/leagues/"
    f"{LIGA}/standings/?season_id={TEMPORADA}"
)

datos_clasificacion = pedir(url_clasificacion)

if not datos_clasificacion or "standings" not in datos_clasificacion:
    print("ERROR obteniendo clasificación")
    exit()

print("Clasificación obtenida.")


# ---------------------------------------------------------
# 2. OBTENER PORTEROS DE LOS 20 EQUIPOS
# ---------------------------------------------------------

porteros = []

for equipo in datos_clasificacion["standings"]:

    team_id = equipo["team_id"]
    team_name = equipo["team_name"]

    url_porteros = (
        f"https://sports.bzzoiro.com/api/v2/players/"
        f"?position=G&team_id={team_id}&limit=200"
    )

    datos = pedir(url_porteros)

    if not datos or "results" not in datos:
        print(f"ERROR obteniendo porteros de {team_name}")
        continue

    for portero in datos["results"]:

        porteros.append({
            "jugador_id": portero["id"],
            "jugador": portero["name"],
            "equipo_id": team_id,
            "equipo": team_name
        })


print(f"Porteros encontrados: {len(porteros)}")


# ---------------------------------------------------------
# 3. FUNCIÓN PARA OBTENER ESTADÍSTICAS DE UN PORTERO
# ---------------------------------------------------------

def obtener_estadisticas(portero):

    jugador_id = portero["jugador_id"]

    url = (
        f"https://sports.bzzoiro.com/api/v2/players/"
        f"{jugador_id}/stats/"
        f"?league_id={LIGA}"
        f"&season_id={TEMPORADA}"
        f"&limit=200"
    )

    datos = pedir(url)

    if not datos or "results" not in datos:
        return None

    minutos = 0
    goles = 0
    partidos = 0

    for stat in datos["results"]:

        minutos_partido = int(
            stat.get("minutes_played", 0) or 0
        )

        goles_partido = int(
            stat.get("goals_conceded", 0) or 0
        )

        minutos += minutos_partido
        goles += goles_partido

        if minutos_partido >= 60:
            partidos += 1

    if partidos == 0:
        return None

    coeficiente = goles / partidos

    portero["minutos"] = minutos
    portero["goles"] = goles
    portero["partidos"] = partidos
    portero["coeficiente"] = coeficiente

    return portero


# ---------------------------------------------------------
# 4. PETICIONES EN PARALELO
# ---------------------------------------------------------

print("Consultando estadísticas en paralelo...")

resultados = []

with ThreadPoolExecutor(max_workers=8) as executor:

    tareas = [
        executor.submit(obtener_estadisticas, portero)
        for portero in porteros
    ]

    for tarea in as_completed(tareas):

        resultado = tarea.result()

        if resultado:
            resultados.append(resultado)


# ---------------------------------------------------------
# 5. DETERMINAR ZAMORA
# ---------------------------------------------------------

# Si ya hay algún portero con 28 o más partidos,
# solo ellos pueden optar al Zamora.
porteros_28 = [
    portero
    for portero in resultados
    if portero["partidos"] >= 28
]

if porteros_28:
    candidatos_zamora = porteros_28
else:
    # Todavía nadie llega a 28:
    # Zamora provisional entre todos.
    candidatos_zamora = resultados


# Mejor coeficiente
mejor_coeficiente = min(
    portero["coeficiente"]
    for portero in candidatos_zamora
)


# Todos los empatados son Zamora
zamoras = [
    portero
    for portero in candidatos_zamora
    if abs(portero["coeficiente"] - mejor_coeficiente) < 0.001
]


# ---------------------------------------------------------
# 6. MOSTRAR SOLO ZAMORA
# ---------------------------------------------------------

print()
print("=" * 70)

if len(zamoras) == 1:
    print("ZAMORA")
else:
    print("ZAMORAS EMPATADOS")

print("=" * 70)

for portero in zamoras:

    print(
        f"{portero['jugador']} "
        f"({portero['equipo']}) - "
        f"{portero['coeficiente']:.2f} | "
        f"GR {portero['goles']} | "
        f"PJ {portero['partidos']} | "
        f"ID jugador: {portero['jugador_id']} | "
        f"ID equipo: {portero['equipo_id']}"
    )


# ---------------------------------------------------------
# 7. TIEMPO TOTAL
# ---------------------------------------------------------

fin = time.time()

print()
print("=" * 70)
print(f"Tiempo total: {fin - inicio:.2f} segundos")
print("=" * 70)
