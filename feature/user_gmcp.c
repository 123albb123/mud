#define GMCP_LOG 50
#define GMCP_ITEMS_VERSION 1
#define GMCP_ENTITIES_VERSION 1

nosave string *gmcp_log = ({});
private nosave mapping gmcp_room_ids = ([]);
private nosave string gmcp_room_session;
private nosave int gmcp_room_sequence;
private nosave mapping gmcp_item_ids = ([]);
private nosave string gmcp_item_session;
private nosave int gmcp_item_sequence;
private nosave int gmcp_inventory_revision;
private nosave int gmcp_equipment_revision;
private nosave string gmcp_inventory_fingerprint;
private nosave string gmcp_equipment_fingerprint;
private nosave mapping gmcp_support_versions = ([]);
private nosave mapping gmcp_client_info = ([]);
private nosave int gmcp_inventory_refresh_pending;
private nosave int gmcp_equipment_refresh_pending;
private nosave mapping gmcp_entity_ids = ([]);
private nosave string gmcp_entity_session;
private nosave int gmcp_entity_sequence;
private nosave int gmcp_entities_revision;
private nosave string gmcp_entities_fingerprint;
private nosave int gmcp_entities_refresh_pending;
private nosave int gmcp_entities_polling;

varargs void sendGMCP(mapping data, mixed *modules...);

private string query_gmcp_room_id(object room)
{
    string key;

    if (!objectp(room))
        return "";

    if (!mapp(gmcp_room_ids))
        gmcp_room_ids = ([]);
    if (!stringp(gmcp_room_session))
        gmcp_room_session = sprintf("%08x", random(0x7fffffff));

    key = file_name(room);
    if (!stringp(gmcp_room_ids[key]))
    {
        gmcp_room_sequence++;
        gmcp_room_ids[key] = sprintf("r-%s-%04d",
                                     gmcp_room_session,
                                     gmcp_room_sequence);
    }

    return gmcp_room_ids[key];
}

private string query_gmcp_item_id(object item)
{
    string key;

    if (!objectp(item))
        return "";

    if (!mapp(gmcp_item_ids))
        gmcp_item_ids = ([]);
    if (!stringp(gmcp_item_session))
        gmcp_item_session = sprintf("%08x", random(0x7fffffff));

    key = file_name(item);
    if (!stringp(gmcp_item_ids[key]))
    {
        gmcp_item_sequence++;
        gmcp_item_ids[key] = sprintf("i-%s-%04d",
                                     gmcp_item_session,
                                     gmcp_item_sequence);
    }

    return gmcp_item_ids[key];
}

private void gmcp_cleanup_item_ids(object *items)
{
    mapping active_items;
    string *keys_to_check;
    string key;
    int i;

    if (!mapp(gmcp_item_ids))
        return;

    active_items = ([]);
    for (i = 0; i < sizeof(items); i++)
    {
        if (objectp(items[i]) && environment(items[i]) == this_object())
            active_items[file_name(items[i])] = 1;
    }

    keys_to_check = keys(gmcp_item_ids);
    for (i = 0; i < sizeof(keys_to_check); i++)
    {
        key = keys_to_check[i];
        if (!active_items[key])
            map_delete(gmcp_item_ids, key);
    }
}

private mixed gmcp_item_query(object item, string key)
{
    mixed value;

    if (!objectp(item) || !stringp(key))
        return 0;
    if (catch(value = item->query(key)))
        return 0;
    return value;
}

private int gmcp_item_is(object item, string method)
{
    mixed result;

    if (!objectp(item) || !stringp(method) || !function_exists(method, item))
        return 0;
    if (catch(result = call_other(item, method)))
        return 0;
    return result ? 1 : 0;
}

private string gmcp_item_text(mixed value)
{
    string text;

    if (!stringp(value))
        return "";
    text = remove_ansi(value);
    text = replace_string(text, "\r", "");
    return replace_string(text, "\n", "");
}

private string gmcp_item_command_id(object item)
{
    mixed ids;
    mixed value;
    string id;
    int i;

    if (function_exists("parse_command_id_list", item) &&
        !catch(ids = item->parse_command_id_list()) && pointerp(ids))
    {
        for (i = 0; i < sizeof(ids); i++)
        {
            value = ids[i];
            if (stringp(value) && value != "")
                return gmcp_item_text(value);
        }
    }

    if (catch(id = item->query("id")) || !stringp(id))
        id = "";
    return gmcp_item_text(id);
}

private int gmcp_item_amount(object item)
{
    mixed value;

    if (function_exists("query_amount", item) &&
        !catch(value = item->query_amount()) && intp(value) && value > 0)
        return value;
    return 1;
}

private int gmcp_item_weight(object item)
{
    mixed value;

    if (function_exists("query_weight", item) &&
        !catch(value = item->query_weight()) && intp(value))
        return value;
    return 0;
}

private string gmcp_item_category(object item)
{
    if (gmcp_item_is(item, "is_weapon"))
        return "weapon";
    if (gmcp_item_is(item, "is_armor"))
        return "armor";
    if (gmcp_item_is(item, "is_food"))
        return "food";
    if (gmcp_item_is(item, "is_liquid"))
        return "liquid";
    if (gmcp_item_is(item, "is_container"))
        return "container";
    if (gmcp_item_is(item, "is_book"))
        return "book";
    if (gmcp_item_is(item, "is_money"))
        return "money";
    if (gmcp_item_is(item, "is_charm"))
        return "charm";
    if (gmcp_item_is(item, "is_rune"))
        return "rune";
    if (gmcp_item_is(item, "is_inlaid"))
        return "inlaid";
    if (gmcp_item_is(item, "is_task"))
        return "task";
    return "misc";
}

private string gmcp_item_equipped(object item)
{
    mixed value;

    value = gmcp_item_query(item, "equipped");
    if (!stringp(value))
        return "";
    return value;
}

private mixed *gmcp_item_actions(object item, string equipped)
{
    mixed *actions;
    mixed no_drop;
    mixed no_wield;

    actions = ({});
    actions += ({(["id": "look"])});
    if (equipped == "wielded")
    {
        actions += ({(["id": "unwield"])});
        return actions;
    }
    if (equipped == "worn")
    {
        actions += ({(["id": "remove"])});
        return actions;
    }

    no_drop = gmcp_item_query(item, "no_drop");
    if (!no_drop)
        actions += ({(["id": "drop"])});

    if (gmcp_item_is(item, "is_food") || gmcp_item_query(item, "only_do_effect"))
        actions += ({(["id": "eat"])});
    if (gmcp_item_is(item, "is_liquid") || mapp(gmcp_item_query(item, "liquid")))
        actions += ({(["id": "drink"])});

    no_wield = gmcp_item_query(item, "no_wield");
    if (gmcp_item_is(item, "is_weapon") && !no_wield)
        actions += ({(["id": "wield"])});
    if (gmcp_item_is(item, "is_armor"))
        actions += ({(["id": "wear"])});

    return actions;
}

private mapping gmcp_inventory_item(object item)
{
    string command_id;
    string equipped;
    string unit;
    string name;
    mapping record;
    mixed value;

    if (!objectp(item))
        return 0;

    name = gmcp_item_text(item->name());
    if (name == "")
        name = gmcp_item_text(item->short());
    command_id = gmcp_item_command_id(item);
    equipped = gmcp_item_equipped(item);
    value = gmcp_item_query(item, "unit");
    unit = stringp(value) ? gmcp_item_text(value) : "";
    record = ([
        "item_id"   : query_gmcp_item_id(item),
        "name"      : name,
        "command_id": command_id,
        "amount"    : gmcp_item_amount(item),
        "unit"      : unit,
        "weight"    : gmcp_item_weight(item),
        "category"  : gmcp_item_category(item),
        "equipped"  : equipped != "",
        "actions"   : gmcp_item_actions(item, equipped),
    ]);
    return record;
}

private mapping gmcp_inventory_snapshot()
{
    object *items;
    mixed *records;
    mapping record;
    int i;

    items = all_inventory(this_object());
    gmcp_cleanup_item_ids(items);
    records = ({});
    for (i = 0; i < sizeof(items); i++)
    {
        record = gmcp_inventory_item(items[i]);
        if (mapp(record))
            records += ({record});
    }
    records = sort_array(records, (: strcmp($1["item_id"], $2["item_id"]) :));

    return ([
        "version" : GMCP_ITEMS_VERSION,
        "snapshot": 1,
        "revision": gmcp_inventory_revision,
        "sequence": gmcp_inventory_revision,
        "items"   : records,
    ]);
}

private string *gmcp_equipment_slot_order()
{
    // These are the armor_type values used by include/armor.h and existing
    // project objects; feet and bandage are retained for legacy objects.
    return ({
        "weapon", "secondary_weapon", "head", "neck", "cloth", "armor",
        "surcoat", "waist", "wrists", "hands", "finger", "boots", "feet",
        "shield", "charm", "bandage",
    });
}

private mapping gmcp_equipment_snapshot()
{
    object *items;
    object secondary_weapon;
    mixed *records;
    mapping item_record;
    mapping record;
    string equipped;
    string slot;
    int i;

    secondary_weapon = this_object()->query_temp("secondary_weapon");
    items = all_inventory(this_object());
    gmcp_cleanup_item_ids(items);
    records = ({});

    for (i = 0; i < sizeof(items); i++)
    {
        equipped = gmcp_item_equipped(items[i]);
        if (equipped == "")
            continue;

        if (equipped == "wielded")
        {
            if (objectp(secondary_weapon) && items[i] == secondary_weapon)
                slot = "secondary_weapon";
            else
                slot = "weapon";
        }
        else if (equipped == "worn")
        {
            slot = items[i]->query("armor_type");
            if (!stringp(slot) || slot == "")
                slot = "armor";
        }
        else
            continue;

        item_record = gmcp_inventory_item(items[i]);
        if (!mapp(item_record))
            continue;
        record = ([
            "slot"      : slot,
            "item_id"   : item_record["item_id"],
            "name"      : item_record["name"],
            "command_id": item_record["command_id"],
            "type"      : item_record["category"],
            "actions"   : item_record["actions"],
        ]);
        records += ({record});
    }
    records = sort_array(records, (: strcmp($1["slot"] + $1["item_id"],
                                           $2["slot"] + $2["item_id"]) :));

    return ([
        "version"   : GMCP_ITEMS_VERSION,
        "snapshot"  : 1,
        "revision"  : gmcp_equipment_revision,
        "sequence"  : gmcp_equipment_revision,
        "slot_order": gmcp_equipment_slot_order(),
        "slots"     : records,
    ]);
}

private string query_gmcp_entity_id(object entity)
{
    string key;

    if (!objectp(entity))
        return "";

    if (!mapp(gmcp_entity_ids))
        gmcp_entity_ids = ([]);
    if (!stringp(gmcp_entity_session))
        gmcp_entity_session = sprintf("%08x", random(0x7fffffff));

    key = file_name(entity);
    if (!stringp(gmcp_entity_ids[key]))
    {
        gmcp_entity_sequence++;
        gmcp_entity_ids[key] = sprintf("e-%s-%04d",
                                       gmcp_entity_session,
                                       gmcp_entity_sequence);
    }

    return gmcp_entity_ids[key];
}

private void gmcp_cleanup_entity_ids(object *entities)
{
    mapping active_entities;
    string *keys_to_check;
    string key;
    int i;

    if (!mapp(gmcp_entity_ids))
        return;

    active_entities = ([]);
    for (i = 0; i < sizeof(entities); i++)
    {
        if (objectp(entities[i]))
            active_entities[file_name(entities[i])] = 1;
    }

    keys_to_check = keys(gmcp_entity_ids);
    for (i = 0; i < sizeof(keys_to_check); i++)
    {
        key = keys_to_check[i];
        if (!active_entities[key])
            map_delete(gmcp_entity_ids, key);
    }
}

private int gmcp_entity_is_corpse(object entity)
{
    return gmcp_item_is(entity, "is_corpse");
}

private string gmcp_entity_type(object entity)
{
    if (!objectp(entity))
        return "unknown";
    if (gmcp_entity_is_corpse(entity))
        return "corpse";
    if (userp(entity))
        return "player";
    if (gmcp_item_is(entity, "is_character"))
        return "npc";
    return "item";
}

private int gmcp_entity_is_visible(object entity)
{
    mixed result;

    if (!objectp(entity))
        return 0;
    if (catch(result = this_object()->visible(entity)))
        return 0;
    return result ? 1 : 0;
}

private string gmcp_entity_name(object entity)
{
    mixed value;

    if (!objectp(entity))
        return "";
    if (!catch(value = entity->name()) && stringp(value))
        return gmcp_item_text(value);
    if (!catch(value = entity->short()) && stringp(value))
        return gmcp_item_text(value);
    return "";
}

private string gmcp_entity_title(object entity, string type)
{
    mixed value;

    if (!objectp(entity))
        return "";
    value = gmcp_item_query(entity, "title");
    if (stringp(value))
        return gmcp_item_text(value);
    if (type == "npc" || type == "player")
        return "";
    if (!catch(value = entity->short()) && stringp(value))
        return gmcp_item_text(value);
    return "";
}

private mixed *gmcp_entity_actions(object entity, string type)
{
    mixed *actions;
    object room;

    if (!objectp(entity))
        return ({});

    actions = ({(["id": "look"])});
    room = environment(this_object());

    if (type == "item" || type == "corpse")
    {
        if (!gmcp_item_query(entity, "no_get") && !living(entity))
            actions += ({(["id": "get"])});
        return actions;
    }

    if (type != "npc" && type != "player")
        return actions;

    if (gmcp_item_query(entity, "can_speak"))
        actions += ({(["id": "ask"])});
    if (function_exists("accept_talk", entity))
        actions += ({(["id": "talk"])});
    if (entity != this_object() && living(entity))
        actions += ({(["id": "give"])});

    if (type != "npc" || !objectp(room) || room->query("no_fight"))
        return actions;
    if (living(entity))
        actions += ({(["id": "fight"])});
    if (!gmcp_entity_is_corpse(entity))
        actions += ({(["id": "kill"])});
    return actions;
}

private mapping gmcp_entity_record(object entity)
{
    string type;
    string name;

    if (!objectp(entity) || entity == this_object() ||
        environment(entity) != environment(this_object()) ||
        !gmcp_entity_is_visible(entity))
        return 0;

    type = gmcp_entity_type(entity);
    if (type == "unknown")
        return 0;
    name = gmcp_entity_name(entity);
    if (name == "")
        return 0;

    return ([
        "entity_id": query_gmcp_entity_id(entity),
        "type"     : type,
        "name"     : name,
        "title"    : gmcp_entity_title(entity, type),
        "actions"  : gmcp_entity_actions(entity, type),
    ]);
}

private mapping gmcp_entities_snapshot()
{
    object room;
    object *entities;
    object *active_entities;
    mixed *records;
    mapping record;
    int i;

    room = environment(this_object());
    entities = objectp(room) ? all_inventory(room) : ({});
    active_entities = ({});
    records = ({});
    for (i = 0; i < sizeof(entities); i++)
    {
        record = gmcp_entity_record(entities[i]);
        if (!mapp(record))
            continue;
        active_entities += ({entities[i]});
        records += ({record});
    }
    gmcp_cleanup_entity_ids(active_entities);
    records = sort_array(records, (: strcmp($1["entity_id"], $2["entity_id"]) :));

    return ([
        "version" : GMCP_ENTITIES_VERSION,
        "snapshot": 1,
        "revision": gmcp_entities_revision,
        "sequence": gmcp_entities_revision,
        "entities": records,
    ]);
}

private string gmcp_snapshot_fingerprint(mixed value)
{
    string result;

    if (catch(result = json_encode(value)))
        return "";
    return result;
}

private int gmcp_supports(string package)
{
    mixed version;

    if (!mapp(gmcp_support_versions) || !stringp(package))
        return 0;
    version = gmcp_support_versions[package];
    return intp(version) && version > 0;
}

varargs void gmcp_refresh_inventory(int force)
{
    mapping inventory;
    string inventory_fingerprint;
    int send_inventory;

    if (!has_gmcp() || (!force && !gmcp_supports("Char.Inventory")))
        return;

    inventory = gmcp_inventory_snapshot();
    inventory_fingerprint = gmcp_snapshot_fingerprint(inventory["items"]);
    send_inventory = force || inventory_fingerprint != gmcp_inventory_fingerprint;

    if (send_inventory)
    {
        if (inventory_fingerprint != gmcp_inventory_fingerprint)
            gmcp_inventory_revision++;
        inventory["revision"] = gmcp_inventory_revision;
        inventory["sequence"] = gmcp_inventory_revision;
        sendGMCP(inventory, "Char", "Inventory");
        gmcp_inventory_fingerprint = inventory_fingerprint;
    }
}

varargs void gmcp_refresh_equipment(int force)
{
    mapping equipment;
    string equipment_fingerprint;
    int send_equipment;

    if (!has_gmcp() || (!force && !gmcp_supports("Char.Equipment")))
        return;

    equipment = gmcp_equipment_snapshot();
    equipment_fingerprint = gmcp_snapshot_fingerprint(equipment["slots"]);
    send_equipment = force || equipment_fingerprint != gmcp_equipment_fingerprint;

    if (send_equipment)
    {
        if (equipment_fingerprint != gmcp_equipment_fingerprint)
            gmcp_equipment_revision++;
        equipment["revision"] = gmcp_equipment_revision;
        equipment["sequence"] = gmcp_equipment_revision;
        sendGMCP(equipment, "Char", "Equipment");
        gmcp_equipment_fingerprint = equipment_fingerprint;
    }
}

varargs void gmcp_refresh_items(int force)
{
    gmcp_refresh_inventory(force);
    gmcp_refresh_equipment(force);
}

varargs void gmcp_refresh_room_entities(int force)
{
    mapping entities;
    string entities_fingerprint;
    int send_entities;

    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Room.Entities"))
        return;

    entities = gmcp_entities_snapshot();
    entities_fingerprint = gmcp_snapshot_fingerprint(entities["entities"]);
    send_entities = force || entities_fingerprint != gmcp_entities_fingerprint;

    if (send_entities)
    {
        if (entities_fingerprint != gmcp_entities_fingerprint)
            gmcp_entities_revision++;
        entities["revision"] = gmcp_entities_revision;
        entities["sequence"] = gmcp_entities_revision;
        sendGMCP(entities, "Room", "Entities");
        gmcp_entities_fingerprint = entities_fingerprint;
    }
}

void gmcp_poll_room_entities()
{
    gmcp_entities_polling = 0;
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Room.Entities"))
        return;

    gmcp_refresh_room_entities();
    gmcp_entities_polling = 1;
    call_out("gmcp_poll_room_entities", 1);
}

private void gmcp_start_room_entity_poll()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Room.Entities") ||
        gmcp_entities_polling)
        return;

    gmcp_entities_polling = 1;
    call_out("gmcp_poll_room_entities", 1);
}

void gmcp_flush_room_entity_refresh()
{
    gmcp_entities_refresh_pending = 0;
    gmcp_refresh_room_entities();
}

void gmcp_room_entities_changed()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Room.Entities") ||
        gmcp_entities_refresh_pending)
        return;

    gmcp_entities_refresh_pending = 1;
    call_out("gmcp_flush_room_entity_refresh", 0);
}

void gmcp_flush_item_refresh()
{
    int refresh_inventory;
    int refresh_equipment;

    refresh_inventory = gmcp_inventory_refresh_pending;
    refresh_equipment = gmcp_equipment_refresh_pending;
    gmcp_inventory_refresh_pending = 0;
    gmcp_equipment_refresh_pending = 0;

    if (refresh_inventory)
        gmcp_refresh_inventory();
    if (refresh_equipment)
        gmcp_refresh_equipment();
}

void gmcp_inventory_changed()
{
    if (!has_gmcp() || gmcp_inventory_refresh_pending)
        return;

    gmcp_inventory_refresh_pending = 1;
    call_out("gmcp_flush_item_refresh", 0);
}

void gmcp_equipment_changed()
{
    if (!has_gmcp() || gmcp_equipment_refresh_pending)
        return;

    gmcp_equipment_refresh_pending = 1;
    call_out("gmcp_flush_item_refresh", 0);
}

void gmcp_items_changed()
{
    gmcp_inventory_changed();
    gmcp_equipment_changed();
}

int gmcp_item_command(string verb)
{
    if (!stringp(verb))
        return 0;

    switch (verb)
    {
    case "get":
    case "drop":
        gmcp_room_entities_changed();
        gmcp_inventory_changed();
        return 1;
    case "give":
    case "put":
    case "eat":
    case "drink":
    case "buy":
    case "sell":
        gmcp_inventory_changed();
        return 1;
    case "wield":
    case "unwield":
    case "wear":
    case "remove":
        gmcp_items_changed();
        return 1;
    }
    return 0;
}

// msp_oob("!!SOUND(10001.wav L=1 V=100 U=https://mud.ren/storage/wav/)");
void msp_oob(string req)
{
#if efun_defined(telnet_msp_oob)
    efun::telnet_msp_oob(req);
#else
    receive("<当前驱动不支持efun telnet_msp_oob()>\n");
#endif
}

protected int dump_gmcp_log()
{
    write(implode(gmcp_log, "\n") + "\n");
    return 1;
}

private void log_gmcp(string msg)
{
    gmcp_log = gmcp_log[ < GMCP_LOG..] + ({msg});
}

void send_gmcp(string gmcp)
{
    efun::send_gmcp(gmcp);
}

varargs void sendGMCP(mapping data, mixed *modules...)
{
    if (!has_gmcp())
        return;

    if (!mapp(data) || !sizeof(modules))
    {
        return;
    }
    else
    {
        string msg = implode(modules, ".");
        catch (msg += " " + json_encode(data));
        log_gmcp("Sending: " + msg);
        send_gmcp(msg);
    }
}

private void gmcp_enable()
{
    message("system", "<GMCP negotiation enabled>\n", this_object());
    sendGMCP(([
        "mud_name": MUD_NAME,
        "protocol": "yanhuang-gmcp",
        "version" : GMCP_ITEMS_VERSION,
        "supports": ([
            "Char.Vitals"    : 1,
            "Room.Info"      : 1,
            "Room.Entities"  : GMCP_ENTITIES_VERSION,
            "Char.Inventory" : GMCP_ITEMS_VERSION,
            "Char.Equipment": GMCP_ITEMS_VERSION,
        ]),
    ]), "Server", "Hello");
}

protected void init_gmcp()
{
    if (!has_gmcp())
        return;
    gmcp_enable();

    // Mudlet Client
    if (env("GUI"))
    {
        sendGMCP((["version":env("GUI.version"), "url":env("GUI.url")]), "Client", "GUI");
    }
    if (sizeof(env("Map")))
    {
        sendGMCP((["url":env("Map")]), "Client", "Map");
    }

    if (wizardp(this_player()))
    {
        add_action("dump_gmcp_log", "gmcp_log");
    }
}

void gmcp_reconnect()
{
    if (!has_gmcp())
        return;

    gmcp_enable();
}

private mapping gmcp_parse_supports(mixed decoded)
{
    mapping result;
    mapping legacy_packages;
    string *parts;
    string package;
    mixed version;
    int i;

    result = ([]);
    if (pointerp(decoded))
    {
        for (i = 0; i < sizeof(decoded); i++)
        {
            if (!stringp(decoded[i]))
                continue;
            parts = explode(decoded[i], " ") - ({""});
            if (sizeof(parts) != 2)
                continue;
            package = parts[0];
            version = to_int(parts[1]);
            if (package != "" && intp(version) && version > 0)
                result[package] = version;
        }
        return result;
    }

    if (!mapp(decoded))
        return result;

    legacy_packages = mapp(decoded["packages"])
        ? decoded["packages"] : decoded;
    foreach (package, version in legacy_packages)
    {
        if (stringp(package) && intp(version) && version > 0)
            result[package] = version;
    }
    return result;
}

private int gmcp_item_action_is_allowed(string action)
{
    return member_array(action, ({
        "look", "drop", "eat", "drink", "wield", "unwield", "wear", "remove",
    })) != -1;
}

private object gmcp_find_item(string item_id)
{
    object *items;
    string key;
    int i;

    if (!stringp(item_id) || !mapp(gmcp_item_ids))
        return 0;

    items = all_inventory(this_object());
    gmcp_cleanup_item_ids(items);
    for (i = 0; i < sizeof(items); i++)
    {
        if (!objectp(items[i]) || environment(items[i]) != this_object())
            continue;
        key = file_name(items[i]);
        if (gmcp_item_ids[key] == item_id)
            return items[i];
    }
    return 0;
}

private int gmcp_item_action_available(object item, string action)
{
    mixed *actions;
    string equipped;
    mapping item_action;
    int i;

    if (!objectp(item) || environment(item) != this_object() ||
        !gmcp_item_action_is_allowed(action))
        return 0;

    equipped = gmcp_item_equipped(item);
    actions = gmcp_item_actions(item, equipped);
    for (i = 0; i < sizeof(actions); i++)
    {
        item_action = actions[i];
        if (mapp(item_action) && item_action["id"] == action)
            return 1;
    }
    return 0;
}

private int gmcp_run_item_action(object item, string action)
{
    mixed result;

    if (!objectp(item) || environment(item) != this_object())
        return 0;

    switch (action)
    {
    case "look":
        if (catch(result = call_other("/cmds/std/look", "look_item", this_object(), item)))
            return -1;
        break;
    case "drop":
        if (catch(result = call_other("/cmds/std/drop", "do_drop", this_object(), item, 0)))
            return -1;
        break;
    case "eat":
        if (catch(result = call_other("/cmds/std/eat", "do_eat", this_object(), item, "", 0)))
            return -1;
        break;
    case "drink":
        if (catch(result = call_other("/cmds/std/drink", "do_drink", this_object(), item, 0)))
            return -1;
        break;
    case "wield":
        if (catch(result = call_other("/cmds/std/wield", "do_wield", this_object(), item)))
            return -1;
        break;
    case "unwield":
        if (catch(result = call_other("/cmds/std/unwield", "do_unwield", this_object(), item)))
            return -1;
        break;
    case "wear":
        if (catch(result = call_other("/cmds/std/wear", "do_wear", this_object(), item)))
            return -1;
        break;
    case "remove":
        if (catch(result = call_other("/cmds/std/remove", "do_remove", this_object(), item)))
            return -1;
        break;
    default:
        return 0;
    }
    return result ? 1 : 0;
}

private void gmcp_item_action_failed(string message)
{
    write(message + "\n");
    // This is an explicit action response. It may resend the current snapshot,
    // but refresh functions keep the revision unchanged when data is unchanged.
    gmcp_refresh_items(1);
}

private void gmcp_item_action_succeeded(string action)
{
    switch (action)
    {
    case "eat":
    case "drink":
        gmcp_inventory_changed();
        break;
    case "wield":
    case "unwield":
    case "wear":
    case "remove":
        gmcp_items_changed();
        break;
    }
}

private void gmcp_handle_web_item_action(string payload)
{
    mixed decoded;
    mapping data;
    object item;
    string item_id;
    string action;
    int result;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_item_action_failed("物品操作请求无效。");
        return;
    }

    data = decoded;
    item_id = data["item_id"];
    action = data["action"];
    if (!stringp(item_id) || !stringp(action) || !gmcp_item_action_is_allowed(action))
    {
        gmcp_item_action_failed("物品操作不被允许。");
        return;
    }

    item = gmcp_find_item(item_id);
    if (!objectp(item))
    {
        gmcp_item_action_failed("该物品已经不在你的行囊中。");
        return;
    }
    if (!gmcp_item_action_available(item, action))
    {
        gmcp_item_action_failed("该物品当前不能执行这个操作。");
        return;
    }

    result = gmcp_run_item_action(item, action);
    if (result < 0)
    {
        gmcp_item_action_failed("物品操作失败，请查看当前状态。");
        return;
    }
    if (!result)
    {
        gmcp_item_action_failed("物品操作未能完成，请查看当前状态。");
        return;
    }

    gmcp_item_action_succeeded(action);
}

private int gmcp_entity_action_is_allowed(string action)
{
    return member_array(action, ({
        "look", "get", "talk", "ask", "fight", "kill", "give",
    })) != -1;
}

private object gmcp_find_entity(string entity_id)
{
    object room;
    object *entities;
    string key;
    int i;

    if (!stringp(entity_id) || !mapp(gmcp_entity_ids))
        return 0;

    room = environment(this_object());
    if (!objectp(room))
        return 0;
    entities = all_inventory(room);
    for (i = 0; i < sizeof(entities); i++)
    {
        if (!objectp(entities[i]) || entities[i] == this_object() ||
            !gmcp_entity_is_visible(entities[i]))
            continue;
        key = file_name(entities[i]);
        if (gmcp_entity_ids[key] == entity_id)
            return entities[i];
    }
    return 0;
}

private int gmcp_entity_action_available(object entity, string action)
{
    mixed *actions;
    mapping entity_action;
    string type;
    int i;

    if (!objectp(entity) || environment(entity) != environment(this_object()) ||
        !gmcp_entity_is_visible(entity) || !gmcp_entity_action_is_allowed(action))
        return 0;

    type = gmcp_entity_type(entity);
    actions = gmcp_entity_actions(entity, type);
    for (i = 0; i < sizeof(actions); i++)
    {
        entity_action = actions[i];
        if (mapp(entity_action) && entity_action["id"] == action)
            return 1;
    }
    return 0;
}

private string gmcp_entity_request_text(mixed value, int required, int limit)
{
    if (!stringp(value))
        return required ? 0 : "";
    if (strsrch(value, "\n") != -1 || strsrch(value, "\r") != -1 ||
        strlen(value) > limit)
        return 0;
    if (required && value == "")
        return 0;
    return value;
}

private int gmcp_run_entity_action(object entity, string action, string text)
{
    mixed result;

    if (!objectp(entity) || environment(entity) != environment(this_object()))
        return 0;

    switch (action)
    {
    case "look":
        if (gmcp_entity_type(entity) == "npc" ||
            gmcp_entity_type(entity) == "player")
        {
            if (catch(result = call_other("/cmds/std/look", "look_living",
                                          this_object(), entity)))
                return -1;
        }
        else if (catch(result = call_other("/cmds/std/look", "look_item",
                                            this_object(), entity)))
            return -1;
        break;
    case "get":
        if (catch(result = call_other("/cmds/std/get", "do_get",
                                      this_object(), entity, 0)))
            return -1;
        break;
    case "talk":
        if (catch(result = call_other("/cmds/std/talk", "do_talk",
                                      this_object(), entity, text)))
            return -1;
        break;
    case "ask":
        if (catch(result = call_other("/cmds/std/ask", "do_ask",
                                      this_object(), entity, text)))
            return -1;
        break;
    case "fight":
        if (catch(result = call_other("/cmds/std/fight", "do_fight",
                                      this_object(), entity)))
            return -1;
        break;
    case "kill":
        if (catch(result = call_other("/cmds/std/kill", "do_kill",
                                      this_object(), entity)))
            return -1;
        break;
    default:
        return 0;
    }
    return result ? 1 : 0;
}

private void gmcp_entity_action_failed(string message)
{
    write(message + "\n");
    // Reconcile a stale request, but preserve revision/fingerprint deduplication
    // so repeated stale clicks cannot create a snapshot storm.
    gmcp_refresh_room_entities();
}

private void gmcp_entity_action_succeeded(string action)
{
    if (action == "get")
    {
        gmcp_room_entities_changed();
        gmcp_inventory_changed();
    }
    else if (action == "fight" || action == "kill")
        gmcp_room_entities_changed();
}

private void gmcp_handle_web_entity_action(string payload)
{
    mixed decoded;
    mapping data;
    object entity;
    string entity_id;
    string action;
    string text;
    int result;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_entity_action_failed("附近实体操作请求无效。");
        return;
    }

    data = decoded;
    entity_id = data["entity_id"];
    action = data["action"];
    if (!stringp(entity_id) || !stringp(action) ||
        !gmcp_entity_action_is_allowed(action))
    {
        gmcp_entity_action_failed("附近实体操作不被允许。");
        return;
    }

    text = gmcp_entity_request_text(data["text"], action == "ask", 200);
    if (!stringp(text))
    {
        gmcp_entity_action_failed("交谈内容无效。");
        return;
    }

    entity = gmcp_find_entity(entity_id);
    if (!objectp(entity))
    {
        gmcp_entity_action_failed("该实体已经不在附近了。");
        return;
    }
    if (!gmcp_entity_action_available(entity, action))
    {
        gmcp_entity_action_failed("该实体当前不能执行这个操作。");
        return;
    }

    result = gmcp_run_entity_action(entity, action, text);
    if (result < 0)
    {
        gmcp_entity_action_failed("附近实体操作失败，请查看当前状态。");
        return;
    }
    if (!result)
    {
        gmcp_entity_action_failed("附近实体操作未能完成，请查看当前状态。");
        return;
    }

    gmcp_entity_action_succeeded(action);
}

private void gmcp_handle_web_entity_give(string payload)
{
    mixed decoded;
    mapping data;
    object item;
    object entity;
    string item_id;
    string entity_id;
    mixed result;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_entity_action_failed("给予请求无效。");
        return;
    }

    data = decoded;
    item_id = data["item_id"];
    entity_id = data["entity_id"];
    if (!stringp(item_id) || !stringp(entity_id))
    {
        gmcp_entity_action_failed("给予请求无效。");
        return;
    }

    item = gmcp_find_item(item_id);
    entity = gmcp_find_entity(entity_id);
    if (!objectp(item) || !objectp(entity) ||
        !gmcp_entity_action_available(entity, "give"))
    {
        gmcp_entity_action_failed("物品或目标已经不再可用。");
        gmcp_refresh_items(1);
        return;
    }

    if (catch(result = call_other("/cmds/std/give", "do_give_to",
                                  this_object(), item, entity)))
    {
        gmcp_entity_action_failed("给予操作失败，请查看当前状态。");
        return;
    }
    if (!result)
    {
        gmcp_entity_action_failed("给予操作未能完成，请查看当前状态。");
        return;
    }

    gmcp_inventory_changed();
    gmcp_room_entities_changed();
}

// gmcp - provides an interface to GMCP data received from the client
void gmcp(string req)
{
    int split;
    string package;
    string payload;
    mixed decoded;

    log_gmcp("Received: " + req);
    split = strsrch(req, " ");
    if (split == -1)
    {
        package = req;
        payload = "";
    }
    else
    {
        package = req[0..split - 1];
        payload = req[split + 1..];
    }

    if (package == "Core.Hello")
    {
        if (!catch(decoded = json_decode(payload)) && mapp(decoded))
        {
            gmcp_client_info = ([]);
            if (stringp(decoded["client"]))
                gmcp_client_info["client"] = decoded["client"];
            if (stringp(decoded["version"]))
                gmcp_client_info["version"] = decoded["version"];
        }
    }
    else if (package == "Core.Supports.Set")
    {
        if (!catch(decoded = json_decode(payload)))
        {
            gmcp_support_versions = gmcp_parse_supports(decoded);
            gmcp_start_room_entity_poll();
        }
    }
    else if (package == "Char.Vitals.Get")
    {
        object ob = this_object();
        mapping my = ob->query_entire_dbase() || ([]);
        // 很奇怪的问题, 得加` || 0`, 否则对0值客户端可能是<userdata 1>
        mapping data = ([
            "hp"         : my["qi"] || 0,
            "max_hp"     : my["max_qi"] || 0,
            "jing"       : my["jing"] || 0,
            "max_jing"   : my["max_jing"] || 0,
            "jingli"     : my["jingli"] || 0,
            "max_jingli" : my["max_jingli"] || 0,
            "neili"      : my["neili"] || 0,
            "max_neili"  : my["max_neili"] || 0,
            "food"       : my["food"] || 0,
            "max_food"   : ob->max_food_capacity(),
            "water"      : my["water"] || 0,
            "max_water"  : ob->max_water_capacity(),
            "exp"        : my["combat_exp"] || 0,
            "pot"        : (int)ob->query("potential") - (int)ob->query("learned_points"),
        ]);
        sendGMCP(data, "Char", "Vitals");
    }
    else if (package == "Room.Info.Get")
    {
        object ob = environment(this_object());
        string room_id;
        mapping room_info;

        if (!objectp(ob))
            return;

        room_id = query_gmcp_room_id(ob);
        room_info = ([
            "name"    : remove_ansi(ob->query("short") || ob->query("name") || ""),
            "exits"   : keys(ob->query("exits") || ([])),
            "area"    : ob->query("outdoors") || explode(base_name(ob), "/")[1],
            "room_id" : room_id,
            // 兼容已经读取 hash 字段的客户端；值不再依赖 crypto efun。
            "hash"    : room_id,
        ]);
        sendGMCP(room_info, "Room", "Info");
        // 音效示例
        if (room_info["name"] == "树林")
        {
            msp_oob("!!SOUND(10001.wav L=1 V=100 U=https://mud.ren/storage/wav/)");
        }
        else
        {
            msp_oob("!!SOUND(Off)");
        }
    }
    else if (package == "Room.Entities.Get")
    {
        gmcp_refresh_room_entities(1);
        gmcp_start_room_entity_poll();
    }
    else if (package == "Char.Inventory.Get")
    {
        gmcp_refresh_inventory(1);
    }
    else if (package == "Char.Equipment.Get")
    {
        gmcp_refresh_equipment(1);
    }
    else if (package == "Web.Item.Action")
    {
        gmcp_handle_web_item_action(payload);
    }
    else if (package == "Web.Entity.Action")
    {
        gmcp_handle_web_entity_action(payload);
    }
    else if (package == "Web.Entity.Give")
    {
        gmcp_handle_web_entity_give(payload);
    }
}
