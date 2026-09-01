#define GMCP_LOG 50
#define GMCP_ITEMS_VERSION 1
#define GMCP_ENTITIES_VERSION 1
#define GMCP_STATE_VERSION 1
#define GMCP_QUEST_VERSION 1
#define GMCP_CHAT_VERSION 1
#define GMCP_ENTITY_POLL_INTERVAL 4
#define GMCP_QUEST_POLL_INTERVAL 4
#define GMCP_CHAT_POLL_INTERVAL 4
#define GMCP_CHAT_TEXT_LIMIT 2048
#define GMCP_ACTION_D "/adm/daemons/gmcp_actiond"

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
private nosave int gmcp_vitals_revision;
private nosave int gmcp_status_revision;
private nosave int gmcp_combat_revision;
private nosave int gmcp_skills_revision;
private nosave int gmcp_combat_actions_revision;
private nosave string gmcp_vitals_fingerprint;
private nosave string gmcp_status_fingerprint;
private nosave string gmcp_combat_fingerprint;
private nosave string gmcp_skills_fingerprint;
private nosave string gmcp_combat_actions_fingerprint;
private nosave int gmcp_vitals_refresh_pending;
private nosave int gmcp_status_refresh_pending;
private nosave int gmcp_combat_refresh_pending;
private nosave int gmcp_skills_refresh_pending;
private nosave int gmcp_combat_actions_refresh_pending;
private nosave int gmcp_realtime_polling;
private nosave mapping gmcp_quest_ids = ([]);
private nosave string gmcp_quest_session;
private nosave int gmcp_quest_sequence;
private nosave int gmcp_quest_revision;
private nosave string gmcp_quest_fingerprint;
private nosave int gmcp_quest_refresh_pending;
private nosave int gmcp_quest_polling;
private nosave string gmcp_chat_session;
private nosave int gmcp_chat_sequence;
private nosave int gmcp_chat_polling;
private nosave int gmcp_chat_capabilities_revision;
private nosave string gmcp_chat_capabilities_fingerprint;
private nosave int gmcp_chat_capabilities_refresh_pending;

varargs void sendGMCP(mapping data, mixed *modules...);
private int gmcp_supports(string package);
private int gmcp_entity_action_available(object entity, string action);
void gmcp_combat_actions_changed();
void gmcp_quests_changed();
void gmcp_chat_capabilities_changed();
void gmcp_chat_channel_message(string channel, object sender, string sender_name,
                               string sender_id, string text, int emote);
void gmcp_chat_say_message(object sender, string text);
void gmcp_chat_private_message(string kind, object sender, object recipient,
                               string text);
private void gmcp_handle_web_chat_send(string payload);

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

    if ((type != "npc" && type != "player") || !objectp(room) ||
        room->query("no_fight"))
        return actions;
    if (entity != this_object() && living(entity))
        actions += ({(["id": "fight"])});
    if (entity != this_object() && !gmcp_entity_is_corpse(entity))
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

private string gmcp_state_fingerprint(mapping snapshot)
{
    mapping data;

    if (!mapp(snapshot))
        return "";
    data = copy(snapshot);
    map_delete(data, "revision");
    map_delete(data, "sequence");
    return gmcp_snapshot_fingerprint(data);
}

private string gmcp_task_text(mixed value, int limit, int multiline)
{
    string text;

    if (!stringp(value))
        return "";

    text = remove_ansi(value);
    text = replace_string(text, "\r", "");
    if (!multiline)
        text = replace_string(text, "\n", " ");
    if (strlen(text) > limit)
        text = text[0..limit - 1];
    return text;
}

private int gmcp_task_number(mixed value)
{
    return intp(value) && value >= 0;
}

private mixed gmcp_quest_method(object quest, string method)
{
    mixed value;

    if (!objectp(quest) || !stringp(method) ||
        !function_exists(method, quest))
        return 0;
    if (catch(value = call_other(quest, method)))
        return 0;
    return value;
}

private object gmcp_load_quest_object(mixed value)
{
    object quest;
    string path;

    if (objectp(value))
        return value;
    if (!stringp(value) || value == "" || strlen(value) > 240 ||
        strsrch(value, "\n") != -1 || strsrch(value, "\r") != -1)
        return 0;

    path = value;
    if (file_size(path) < 0 && file_size(path + ".c") < 0)
        return 0;
    if (catch(quest = load_object(path)))
        return 0;
    return quest;
}

private string gmcp_quest_source(object quest)
{
    string path;

    if (!objectp(quest))
        return "";
    if (catch(path = base_name(quest)) || !stringp(path))
        return "";
    return path;
}

private string query_gmcp_quest_id(string source)
{
    if (!stringp(source) || source == "")
        return "";
    if (!mapp(gmcp_quest_ids))
        gmcp_quest_ids = ([]);
    if (!stringp(gmcp_quest_session))
        gmcp_quest_session = sprintf("%08x", random(0x7fffffff));
    if (!stringp(gmcp_quest_ids[source]))
    {
        gmcp_quest_sequence++;
        gmcp_quest_ids[source] = sprintf("q-%s-%04d",
                                         gmcp_quest_session,
                                         gmcp_quest_sequence);
    }
    return gmcp_quest_ids[source];
}

private void gmcp_cleanup_quest_ids(string *active_sources)
{
    string *sources;
    int i;

    if (!mapp(gmcp_quest_ids))
        return;
    sources = keys(gmcp_quest_ids);
    for (i = 0; i < sizeof(sources); i++)
    {
        if (member_array(sources[i], active_sources) == -1)
            map_delete(gmcp_quest_ids, sources[i]);
    }
}

private mapping gmcp_traditional_quest_record(mapping quest)
{
    mapping record;
    mapping objective;
    string type;
    string title;
    string detail;
    string value;
    mixed level;
    mixed deadline;

    if (!mapp(quest) || !stringp(type = quest["type"]) ||
        (type != "kill" && type != "letter"))
        return 0;

    title = gmcp_task_text(quest["name"], 160, 0);
    if (title == "")
        title = "师门任务";
    detail = "";
    value = gmcp_task_text(quest["master_name"], 160, 0);
    if (value != "")
        detail += value + "交给你的任务";
    value = gmcp_task_text(quest["place"], 240, 0);
    if (value != "")
        detail += (detail == "" ? "" : "；") + "据说目标曾在" + value + "出没";
    value = gmcp_task_text(quest["family"], 160, 0);
    if (value != "")
        detail += (detail == "" ? "" : "；") + "回" + value + "交差";
    if (detail == "")
        detail = title;

    objective = ([
        "kind" : type == "kill" ? "kill" : "deliver",
        "title": title,
    ]);
    value = gmcp_task_text(quest["id"], 160, 0);
    if (value != "")
        objective["detail"] = value;

    record = ([
        "quest_id": query_gmcp_quest_id("traditional"),
        "system"  : "traditional",
        "category": type,
        "title"   : title,
        "detail"  : detail,
        "status"  : "active",
        "objectives": ({objective}),
    ]);
    level = quest["level"];
    if (gmcp_task_number(level))
        record["level"] = level;
    deadline = quest["limit"];
    if (gmcp_task_number(deadline) && deadline > 0)
        record["deadline"] = deadline;
    return record;
}

private mapping gmcp_quest2_objective(string kind, mixed target_file,
                                      mixed current, mixed required)
{
    object target;
    mapping objective;
    string title;
    string path;

    if (!stringp(target_file))
        return 0;
    path = target_file;
    target = gmcp_load_quest_object(path);
    if (!objectp(target))
        return 0;
    title = gmcp_entity_name(target);
    if (title == "")
        return 0;

    objective = ([
        "kind" : kind,
        "title": title,
    ]);
    if (gmcp_task_number(current))
        objective["current"] = current;
    if (gmcp_task_number(required))
        objective["required"] = required;
    return objective;
}

private mixed gmcp_quest_progress(mapping progress, string section,
                                  string path)
{
    mapping values;

    if (!mapp(progress) || !stringp(section) || !stringp(path) ||
        !mapp(values = progress[section]))
        return 0;
    return values[path];
}

private mapping gmcp_quest2_record(object quest, mapping progress,
                                   string status)
{
    mapping record;
    mapping requirements;
    mapping objective;
    mixed value;
    string title;
    string detail;
    string source;
    string *keys_to_check;
    mixed current;
    mixed required;
    int i;

    if (!objectp(quest) || !stringp(status) ||
        !gmcp_quest_method(quest, "isQuest"))
        return 0;

    title = gmcp_task_text(gmcp_quest_method(quest, "getName"), 160, 0);
    detail = gmcp_task_text(gmcp_quest_method(quest, "getDetail"), 4096, 1);
    if (title == "")
        title = "江湖任务";
    if (detail == "")
        detail = title;
    source = gmcp_quest_source(quest);
    if (source == "")
        return 0;

    record = ([
        "quest_id": query_gmcp_quest_id("quest2:" + source),
        "system"  : "quest2",
        "category": "quest2",
        "title"   : title,
        "detail"  : detail,
        "status"  : status,
        "objectives": ({}),
    ]);
    value = gmcp_quest_method(quest, "getLevel");
    if (gmcp_task_number(value))
        record["level"] = value;

    requirements = gmcp_quest_method(quest, "getKill");
    if (mapp(requirements))
    {
        keys_to_check = keys(requirements);
        for (i = 0; i < sizeof(keys_to_check); i++)
        {
            required = requirements[keys_to_check[i]];
            current = gmcp_quest_progress(progress, "killed",
                                          keys_to_check[i]);
            objective = gmcp_quest2_objective("kill", keys_to_check[i],
                                              current, required);
            if (mapp(objective))
                record["objectives"] += ({objective});
        }
    }

    requirements = gmcp_quest_method(quest, "getItem");
    if (mapp(requirements))
    {
        keys_to_check = keys(requirements);
        for (i = 0; i < sizeof(keys_to_check); i++)
        {
            required = requirements[keys_to_check[i]];
            current = gmcp_quest_progress(progress, "item",
                                          keys_to_check[i]);
            objective = gmcp_quest2_objective("collect", keys_to_check[i],
                                              current, required);
            if (mapp(objective))
                record["objectives"] += ({objective});
        }
    }
    return record;
}

private mapping gmcp_ultra_quest_record()
{
    mapping state;
    mapping quest;
    mapping objective;
    mapping record;
    string title;
    string detail;
    string type;
    string target;

    state = this_object()->query("ultra_quest");
    if (!mapp(state) || !mapp(quest = state["quest"]))
        return 0;

    type = gmcp_task_text(quest["type"], 80, 0);
    target = gmcp_task_text(quest["obj"], 240, 0);
    title = target;
    if (title == "")
        title = "大宗师任务";
    detail = gmcp_task_text(quest["msg"], 4096, 1);
    if (detail == "")
        detail = title;
    record = ([
        "quest_id": query_gmcp_quest_id("ultra"),
        "system"  : "ultra",
        "category": type == "" ? "ultra" : type,
        "title"   : title,
        "detail"  : detail,
        "status"  : quest["fail"] ? "failed" : "active",
        "objectives": ({}),
    ]);
    if (type != "")
    {
        objective = ([
            "kind" : type,
            "title": target == "" ? title : target,
        ]);
        record["objectives"] = ({objective});
    }
    return record;
}

private mapping gmcp_mirror_quest_record(object item)
{
    mapping record;
    mapping objective;
    mixed task_time;
    mixed owner_id;
    string title;
    string owner;
    string source;

    if (!objectp(item) || !gmcp_item_is(item, "is_task"))
        return 0;
    task_time = gmcp_item_query(item, "task_time");
    if (!gmcp_task_number(task_time) || task_time <= 0)
        return 0;
    title = gmcp_entity_name(item);
    if (title == "")
        return 0;
    owner_id = gmcp_item_query(item, "owner_id");
    owner = gmcp_task_text(owner_id, 160, 0);
    source = "mirror:" + file_name(item);
    record = ([
        "quest_id": query_gmcp_quest_id(source),
        "system"  : "mirror",
        "category": "mirror",
        "title"   : title,
        "detail"  : owner == "" ? "宝镜任务物品" : "交给" + owner,
        "status"  : "active",
        "objectives": ({}),
    ]);
    objective = ([
        "kind" : "deliver",
        "title": owner == "" ? "交给任务发布者" : "交给" + owner,
    ]);
    record["objectives"] = ({objective});
    return record;
}

private mapping gmcp_add_quest2_records(mapping progress_by_key,
                                        mixed *quest_keys, string status)
{
    object quest;
    mapping record;
    mapping progress;
    mapping result;
    mixed *records;
    string source;
    string *sources;
    int i;

    records = ({});
    sources = ({});
    if (!pointerp(quest_keys))
        return (["records": records, "sources": sources]);
    for (i = 0; i < sizeof(quest_keys); i++)
    {
        quest = gmcp_load_quest_object(quest_keys[i]);
        if (!objectp(quest))
            continue;
        progress = mapp(progress_by_key) &&
                   mapp(progress_by_key[quest_keys[i]])
                   ? progress_by_key[quest_keys[i]] : ([]);
        record = gmcp_quest2_record(quest, progress, status);
        if (!mapp(record))
            continue;
        records += ({record});
        source = gmcp_quest_source(quest);
        if (source != "")
            sources += ({"quest2:" + source});
    }
    result = ([
        "records": records,
        "sources": sources,
    ]);
    return result;
}

private mapping gmcp_quest_snapshot()
{
    mapping quest;
    mapping todo;
    mapping record;
    mapping batch;
    mapping stats;
    mixed *todo_keys;
    mixed *solved_keys;
    mixed *active;
    mixed *completed;
    object *inventory;
    object item;
    int *date;
    int day;
    int i;
    string festival;
    string *active_sources;
    string *quest_sources;

    active = ({});
    completed = ({});
    active_sources = ({});
    quest_sources = ({});

    quest = this_object()->query("quest");
    record = gmcp_traditional_quest_record(quest);
    if (mapp(record))
    {
        active += ({record});
        active_sources += ({"traditional"});
    }

    todo = ([]);
    if (function_exists("getToDoList", this_object()) &&
        !catch(todo = this_object()->getToDoList()) && mapp(todo))
    {
        todo_keys = keys(todo);
        batch = gmcp_add_quest2_records(todo, todo_keys, "active");
        if (mapp(batch))
        {
            active += batch["records"];
            quest_sources += batch["sources"];
        }
    }

    solved_keys = ({});
    if (function_exists("getSolved", this_object()) &&
        !catch(solved_keys = this_object()->getSolved()) &&
        pointerp(solved_keys))
    {
        batch = gmcp_add_quest2_records(([]), solved_keys, "completed");
        if (mapp(batch))
        {
            completed += batch["records"];
            quest_sources += batch["sources"];
        }
    }

    record = gmcp_ultra_quest_record();
    if (mapp(record))
    {
        active += ({record});
        active_sources += ({"ultra"});
    }

    date = localtime(time());
    day = date[3];
    festival = "festival/" + date[5] + "/" + (date[4] + 1);
    record = ([
        "quest_id": query_gmcp_quest_id("daily:temple"),
        "system"  : "daily",
        "category": "daily",
        "title"   : "扬州武庙二楼祈福",
        "detail"  : "每日任务",
        "status"  : this_object()->query(festival) == day
                      ? "completed" : "available",
        "objectives": ({(["kind": "daily", "title": "祈福"])}),
    ]);
    if (record["status"] == "completed")
        completed += ({record});
    else
        active += ({record});
    active_sources += ({"daily:temple"});

    inventory = all_inventory(this_object());
    for (i = 0; i < sizeof(inventory); i++)
    {
        item = inventory[i];
        record = gmcp_mirror_quest_record(item);
        if (!mapp(record))
            continue;
        active += ({record});
        active_sources += ({"mirror:" + file_name(item)});
    }

    gmcp_cleanup_quest_ids(active_sources + quest_sources);
    active = sort_array(active, (: strcmp($1["quest_id"], $2["quest_id"]) :));
    completed = sort_array(completed,
                           (: strcmp($1["quest_id"], $2["quest_id"]) :));
    stats = ([]);
    if (gmcp_task_number(this_object()->query("quest_count")))
        stats["traditional_completed"] = this_object()->query("quest_count");
    if (gmcp_task_number(this_object()->query("mirror_count")))
        stats["mirror_completed"] = this_object()->query("mirror_count");
    stats["active_count"] = sizeof(active);
    stats["completed_count"] = sizeof(completed);

    return ([
        "version"  : GMCP_QUEST_VERSION,
        "snapshot" : 1,
        "revision" : gmcp_quest_revision,
        "sequence" : gmcp_quest_revision,
        "quests"   : active,
        "completed": completed,
        "stats"    : stats,
    ]);
}

varargs void gmcp_refresh_quests(int force)
{
    mapping quests;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Quest.List")))
        return;

    quests = gmcp_quest_snapshot();
    fingerprint = gmcp_state_fingerprint(quests);
    if (!force && fingerprint == gmcp_quest_fingerprint)
        return;
    if (fingerprint != gmcp_quest_fingerprint)
        gmcp_quest_revision++;
    quests["revision"] = gmcp_quest_revision;
    quests["sequence"] = gmcp_quest_revision;
    sendGMCP(quests, "Quest", "List");
    gmcp_quest_fingerprint = fingerprint;
}

private mapping gmcp_chat_capabilities_snapshot()
{
    mapping capabilities;
    mapping snapshot;
    object channel_daemon;

    capabilities = ([]);
    channel_daemon = find_object(CHANNEL_D);
    if (!objectp(channel_daemon))
        channel_daemon = load_object(CHANNEL_D);
    if (objectp(channel_daemon) &&
        function_exists("query_web_capabilities", channel_daemon) &&
        !catch(capabilities = channel_daemon->query_web_capabilities(this_object())) &&
        mapp(capabilities))
        snapshot = copy(capabilities);
    else
        snapshot = ([]);

    snapshot["version"] = GMCP_CHAT_VERSION;
    snapshot["snapshot"] = 1;
    snapshot["revision"] = gmcp_chat_capabilities_revision;
    snapshot["sequence"] = gmcp_chat_capabilities_revision;
    if (!pointerp(snapshot["channels"]))
        snapshot["channels"] = ({});
    if (!intp(snapshot["can_say"]))
        snapshot["can_say"] = 0;
    if (!intp(snapshot["can_tell"]))
        snapshot["can_tell"] = 0;
    if (!intp(snapshot["can_reply"]))
        snapshot["can_reply"] = 0;
    snapshot["max_text"] = GMCP_CHAT_TEXT_LIMIT;
    return snapshot;
}

varargs void gmcp_refresh_chat_capabilities(int force)
{
    mapping capabilities;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Chat.Capabilities")))
        return;

    capabilities = gmcp_chat_capabilities_snapshot();
    fingerprint = gmcp_state_fingerprint(capabilities);
    if (!force && fingerprint == gmcp_chat_capabilities_fingerprint)
        return;
    if (fingerprint != gmcp_chat_capabilities_fingerprint)
        gmcp_chat_capabilities_revision++;
    capabilities["revision"] = gmcp_chat_capabilities_revision;
    capabilities["sequence"] = gmcp_chat_capabilities_revision;
    sendGMCP(capabilities, "Chat", "Capabilities");
    gmcp_chat_capabilities_fingerprint = fingerprint;
}

void gmcp_flush_quest_refresh()
{
    gmcp_quest_refresh_pending = 0;
    gmcp_refresh_quests();
}

void gmcp_quests_changed()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Quest.List") || gmcp_quest_refresh_pending)
        return;
    gmcp_quest_refresh_pending = 1;
    call_out("gmcp_flush_quest_refresh", 0);
}

void gmcp_poll_quest_state()
{
    gmcp_quest_polling = 0;
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Quest.List"))
        return;
    gmcp_refresh_quests();
    gmcp_quest_polling = 1;
    call_out("gmcp_poll_quest_state", GMCP_QUEST_POLL_INTERVAL);
}

private void gmcp_start_quest_poll()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Quest.List") || gmcp_quest_polling)
        return;
    gmcp_quest_polling = 1;
    call_out("gmcp_poll_quest_state", GMCP_QUEST_POLL_INTERVAL);
}

void gmcp_flush_chat_capabilities()
{
    gmcp_chat_capabilities_refresh_pending = 0;
    gmcp_refresh_chat_capabilities();
}

void gmcp_chat_capabilities_changed()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Capabilities") ||
        gmcp_chat_capabilities_refresh_pending)
        return;
    gmcp_chat_capabilities_refresh_pending = 1;
    call_out("gmcp_flush_chat_capabilities", 0);
}

void gmcp_poll_chat_capabilities()
{
    gmcp_chat_polling = 0;
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Capabilities"))
        return;
    gmcp_refresh_chat_capabilities();
    gmcp_chat_polling = 1;
    call_out("gmcp_poll_chat_capabilities", GMCP_CHAT_POLL_INTERVAL);
}

private void gmcp_start_chat_capability_poll()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Capabilities") || gmcp_chat_polling)
        return;
    gmcp_chat_polling = 1;
    call_out("gmcp_poll_chat_capabilities", GMCP_CHAT_POLL_INTERVAL);
}

private string gmcp_chat_text(mixed value)
{
    string text;
    string safe_text;
    int i;

    if (!stringp(value))
        return "";
    text = remove_ansi(value);
    safe_text = "";
    for (i = 0; i < strlen(text); i++)
    {
        if (text[i] < 32 || text[i] == 127)
            safe_text += " ";
        else
            safe_text += text[i..i];
        if (strlen(safe_text) >= GMCP_CHAT_TEXT_LIMIT)
            break;
    }
    return safe_text;
}

private mapping gmcp_chat_actor(object actor, string supplied_name,
                                string supplied_id)
{
    mapping result;
    mixed value;
    string name;
    string id;

    name = gmcp_chat_text(supplied_name);
    id = gmcp_chat_text(supplied_id);
    if (objectp(actor))
    {
        if (name == "" && !catch(value = actor->name(1)) && stringp(value))
            name = gmcp_chat_text(value);
        if (name == "" && !catch(value = actor->short()) && stringp(value))
            name = gmcp_chat_text(value);
        if (id == "" && !catch(value = actor->query("id")) && stringp(value))
            id = gmcp_chat_text(value);
    }
    if (name == "")
        name = "某人";
    result = (["name": name]);
    if (id != "")
        result["id"] = id;
    return result;
}

private void gmcp_chat_send_event(string kind, string text, string channel,
                                  object sender, string sender_name,
                                  string sender_id, object recipient, int emote)
{
    mapping event;
    mapping actor;
    string direction;

    if (!has_gmcp() || !gmcp_supports("Chat.Message") ||
        (kind != "channel" && kind != "say" && kind != "tell" &&
         kind != "reply"))
        return;
    text = gmcp_chat_text(text);
    if (text == "")
        return;

    actor = gmcp_chat_actor(sender, sender_name, sender_id);
    direction = objectp(sender) && sender == this_object() ? "out" : "in";
    event = ([
        "version"   : GMCP_CHAT_VERSION,
        "message_id": "",
        "timestamp" : time(),
        "kind"      : kind,
        "direction" : direction,
        "sender"    : actor,
        "text"      : text,
    ]);
    if (!stringp(gmcp_chat_session))
        gmcp_chat_session = sprintf("%08x", random(0x7fffffff));
    gmcp_chat_sequence++;
    event["message_id"] = sprintf("m-%s-%06d", gmcp_chat_session,
                                   gmcp_chat_sequence);
    if (kind == "channel" && stringp(channel) && channel != "")
        event["channel"] = gmcp_chat_text(channel);
    if (objectp(recipient))
        event["recipient"] = gmcp_chat_actor(recipient, "", "");
    if (emote)
        event["emote"] = 1;
    sendGMCP(event, "Chat", "Message");
}

void gmcp_chat_channel_message(string channel, object sender,
                               string sender_name, string sender_id,
                               string text, int emote)
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Message"))
        return;
    gmcp_chat_send_event("channel", text, channel, sender, sender_name,
                         sender_id, 0, emote);
}

void gmcp_chat_say_message(object sender, string text)
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Message"))
        return;
    gmcp_chat_send_event("say", text, "", sender, "", "", 0, 0);
}

void gmcp_chat_private_message(string kind, object sender, object recipient,
                               string text)
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Chat.Message") ||
        (kind != "tell" && kind != "reply"))
        return;
    gmcp_chat_send_event(kind, text, "", sender, "", "", recipient, 0);
}

private int gmcp_supports(string package)
{
    mixed version;

    if (!mapp(gmcp_support_versions) || !stringp(package))
        return 0;
    version = gmcp_support_versions[package];
    return intp(version) && version > 0;
}

private int gmcp_safe_skill_id(string value)
{
    int i;

    if (!stringp(value) || value == "" || strlen(value) > 64)
        return 0;

    for (i = 0; i < strlen(value); i++)
    {
        if ((value[i] >= 'a' && value[i] <= 'z') ||
            (value[i] >= '0' && value[i] <= '9') ||
            value[i] == '-' || value[i] == '_')
            continue;
        return 0;
    }
    return 1;
}

private int gmcp_safe_entity_id(string value)
{
    int i;

    if (!stringp(value) || strlen(value) < 4 || strlen(value) > 96 ||
        value[0] != 'e' || value[1] != '-')
        return 0;
    for (i = 2; i < strlen(value); i++)
    {
        if ((value[i] >= 'a' && value[i] <= 'z') ||
            (value[i] >= 'A' && value[i] <= 'Z') ||
            (value[i] >= '0' && value[i] <= '9') || value[i] == '-')
            continue;
        return 0;
    }
    return 1;
}

private string gmcp_skill_name(string skill)
{
    string name;

    if (!gmcp_safe_skill_id(skill))
        return "";
    if (catch(name = to_chinese(skill)) || !stringp(name))
        return skill;
    return gmcp_item_text(name);
}

private string gmcp_skill_type(string skill)
{
    string type;

    if (!gmcp_safe_skill_id(skill) || file_size(SKILL_D(skill) + ".c") < 0)
        return "unknown";
    if (catch(type = SKILL_D(skill)->type()) || !stringp(type))
        return "unknown";
    return gmcp_item_text(type);
}

private string *gmcp_valid_skill_types()
{
    mixed types;

    if (catch(types = MASTER_D->query_valid_types()) || !pointerp(types))
        return ({});
    return filter_array(types, (: gmcp_safe_skill_id :));
}

private mapping gmcp_vitals_snapshot()
{
    mapping my;
    object me;

    me = this_object();
    my = me->query_entire_dbase() || ([]);
    return ([
        "version"    : GMCP_STATE_VERSION,
        "snapshot"   : 1,
        "revision"   : gmcp_vitals_revision,
        "sequence"   : gmcp_vitals_revision,
        "hp"         : my["qi"] || 0,
        "max_hp"     : my["max_qi"] || 0,
        "jing"       : my["jing"] || 0,
        "max_jing"   : my["max_jing"] || 0,
        "jingli"     : my["jingli"] || 0,
        "max_jingli" : my["max_jingli"] || 0,
        "neili"      : my["neili"] || 0,
        "max_neili"  : my["max_neili"] || 0,
        "food"       : my["food"] || 0,
        "max_food"   : me->max_food_capacity(),
        "water"      : my["water"] || 0,
        "max_water"  : me->max_water_capacity(),
        "exp"        : my["combat_exp"] || 0,
        "pot"        : (int)me->query("potential") -
                       (int)me->query("learned_points"),
    ]);
}

private mixed *gmcp_skill_assignments(mapping assignments)
{
    mixed *records;
    string *slots;
    string slot;
    string skill;
    int i;

    records = ({});
    if (!mapp(assignments))
        return records;

    slots = sort_array(keys(assignments), (: strcmp :));
    for (i = 0; i < sizeof(slots); i++)
    {
        slot = slots[i];
        skill = assignments[slot];
        if (!gmcp_safe_skill_id(slot) || !gmcp_safe_skill_id(skill))
            continue;
        records += ({([
            "slot"    : slot,
            "skill_id": skill,
            "name"    : gmcp_skill_name(skill),
        ])});
    }
    return records;
}

private mapping gmcp_status_snapshot()
{
    mapping my;
    mapping weapon_data;
    mapping skill_map;
    mapping skill_prepare;
    object me;
    object weapon;
    string skill_type;
    string skill;
    mixed anger;
    int ghost;
    int unconscious;

    me = this_object();
    my = me->query_entire_dbase() || ([]);
    ghost = 0;
    if (function_exists("is_ghost", me))
        catch(ghost = (int)me->is_ghost());
    unconscious = !living(me) && !ghost;
    skill_map = me->query_skill_map();
    skill_prepare = me->query_skill_prepare();
    if (!mapp(skill_map))
        skill_map = ([]);
    if (!mapp(skill_prepare))
        skill_prepare = ([]);

    weapon_data = 0;
    if (objectp(weapon = me->query_temp("weapon")))
    {
        skill_type = gmcp_item_query(weapon, "skill_type");
        skill = stringp(skill_type) ? me->query_skill_mapped(skill_type) : 0;
        weapon_data = ([
            "name"      : gmcp_entity_name(weapon),
            "skill_type": stringp(skill_type) ? skill_type : "",
        ]);
        if (gmcp_safe_skill_id(skill))
        {
            weapon_data["skill_id"] = skill;
            weapon_data["skill_name"] = gmcp_skill_name(skill);
        }
    }

    anger = 0;
    if (function_exists("query_craze", me))
        catch(anger = me->query_craze());

    return ([
        "version"  : GMCP_STATE_VERSION,
        "snapshot" : 1,
        "revision" : gmcp_status_revision,
        "sequence" : gmcp_status_revision,
        "busy"     : me->is_busy() ? 1 : 0,
        "fighting" : me->is_fighting() ? 1 : 0,
        "can_act"  : (!me->is_busy() && !ghost && !unconscious) ? 1 : 0,
        // Force a JSON boolean-compatible integer even when an inherited
        // is_ghost() implementation returns an untyped zero value.
        "ghost"    : ghost ? 1 : 0,
        "unconscious": unconscious,
        "anger"    : intp(anger) ? anger : 0,
        "food"     : my["food"] || 0,
        "water"    : my["water"] || 0,
        "exp"      : my["combat_exp"] || 0,
        "potential": (int)me->query("potential") -
                     (int)me->query("learned_points"),
        "weapon"   : weapon_data,
        "enabled"  : gmcp_skill_assignments(skill_map),
        "prepared" : gmcp_skill_assignments(skill_prepare),
    ]);
}

private mapping gmcp_skills_snapshot()
{
    mapping skills;
    mapping learned;
    mapping enabled;
    mapping prepared;
    mapping prepare_types;
    mapping record;
    mixed *records;
    string *skill_ids;
    string *enabled_slots;
    string *prepared_slots;
    string *prepare_slots;
    string *prepare_type_slots;
    string *prepared_keys;
    string *enable_slots;
    string *basic_types;
    string skill;
    string prepare_slot;
    mixed valid_enable;
    mixed valid_combine;
    int level;
    int progress;
    int prepare_index;
    int i;

    skills = this_object()->query_skills();
    learned = this_object()->query_learned();
    enabled = this_object()->query_skill_map();
    prepared = this_object()->query_skill_prepare();
    if (!mapp(skills))
        skills = ([]);
    if (!mapp(learned))
        learned = ([]);
    if (!mapp(enabled))
        enabled = ([]);
    if (!mapp(prepared))
        prepared = ([]);
    basic_types = gmcp_valid_skill_types();
    prepare_types = ([]);
    catch(prepare_types = call_other("/cmds/skill/prepare",
                                     "query_valid_types"));
    if (!mapp(prepare_types))
        prepare_types = ([]);
    prepare_type_slots = sort_array(keys(prepare_types), (: strcmp :));

    records = ({});
    skill_ids = sort_array(keys(skills), (: strcmp :));
    for (i = 0; i < sizeof(skill_ids); i++)
    {
        skill = skill_ids[i];
        if (!gmcp_safe_skill_id(skill) || !intp(skills[skill]))
            continue;
        level = skills[skill];
        progress = (int)learned[skill] * 100 /
                   ((level + 1) * (level + 1) + 1);
        if (progress < 0)
            progress = 0;
        if (progress > 100)
            progress = 100;

        enabled_slots = ({});
        foreach (string slot, string mapped_skill in enabled)
            if (mapped_skill == skill && gmcp_safe_skill_id(slot))
                enabled_slots += ({slot});
        prepared_slots = ({});
        foreach (string slot, string prepared_skill in prepared)
            if (prepared_skill == skill && gmcp_safe_skill_id(slot))
                prepared_slots += ({slot});
        prepare_slots = ({});
        if (member_array(skill, basic_types) == -1)
        {
            for (prepare_index = 0;
                 prepare_index < sizeof(prepare_type_slots);
                 prepare_index++)
            {
                prepare_slot = prepare_type_slots[prepare_index];
                if (!gmcp_safe_skill_id(prepare_slot) ||
                    this_object()->query_skill_mapped(prepare_slot) != skill)
                    continue;
                if (member_array(prepare_slot, prepared_slots) != -1)
                {
                    prepare_slots += ({prepare_slot});
                    continue;
                }
                if (sizeof(prepared) >= 2)
                    continue;
                valid_combine = 1;
                if (sizeof(prepared) == 1)
                {
                    prepared_keys = keys(prepared);
                    valid_combine = 0;
                    if (sizeof(prepared_keys) == 1)
                        catch(valid_combine =
                             SKILL_D(skill)->valid_combine(
                                 prepared[prepared_keys[0]]));
                }
                if (valid_combine)
                    prepare_slots += ({prepare_slot});
            }
        }
        enable_slots = ({});
        foreach (string basic_slot in basic_types)
        {
            valid_enable = 0;
            catch(valid_enable = SKILL_D(skill)->valid_enable(basic_slot));
            if (basic_slot != skill && this_object()->query_skill(basic_slot, 1) > 0 &&
                valid_enable)
                enable_slots += ({basic_slot});
        }

        record = ([
            "skill_id"    : skill,
            "name"        : gmcp_skill_name(skill),
            "level"       : level,
            "progress"    : progress,
            "type"        : gmcp_skill_type(skill),
            "is_basic"    : member_array(skill, basic_types) != -1,
            "enabled_for" : sort_array(enabled_slots, (: strcmp :)),
            "prepared_for": sort_array(prepared_slots, (: strcmp :)),
            "prepare_slots": sort_array(prepare_slots, (: strcmp :)),
            "enable_slots": sort_array(enable_slots, (: strcmp :)),
        ]);
        records += ({record});
    }

    return ([
        "version" : GMCP_STATE_VERSION,
        "snapshot": 1,
        "revision": gmcp_skills_revision,
        "sequence": gmcp_skills_revision,
        "skills"  : records,
    ]);
}

private string gmcp_combat_health(object target)
{
    int max_qi;
    int eff_qi;
    int ratio;

    if (!objectp(target) || !living(target))
        return "unconscious";
    max_qi = (int)target->query("max_qi");
    eff_qi = (int)target->query("eff_qi");
    if (max_qi < 1)
        return "unknown";
    ratio = eff_qi * 100 / max_qi;
    // These ranges intentionally mirror look.c's public wound descriptions;
    // no numeric health, internal resources, skills, or AI state leave LPC.
    if (ratio > 90)
        return "healthy";
    if (ratio > 60)
        return "injured";
    if (ratio > 20)
        return "badly_injured";
    return "near_death";
}

private mapping gmcp_combat_snapshot()
{
    object me;
    object *enemies;
    object enemy;
    object primary;
    mixed *targets;
    string entity_id;
    int i;

    me = this_object();
    me->clean_up_enemy();
    enemies = me->query_enemy();
    if (!pointerp(enemies))
        enemies = ({});
    targets = ({});
    primary = me->query_temp("last_opponent");

    for (i = 0; i < sizeof(enemies); i++)
    {
        enemy = enemies[i];
        if (!objectp(enemy) || environment(enemy) != environment(me) ||
            !gmcp_entity_is_visible(enemy))
            continue;
        entity_id = query_gmcp_entity_id(enemy);
        targets += ({([
            "entity_id": entity_id,
            "name"     : gmcp_entity_name(enemy),
            "relation" : me->is_killing(enemy) ? "kill" : "fight",
            "health"   : gmcp_combat_health(enemy),
        ])});
    }
    targets = sort_array(targets, (: strcmp($1["entity_id"], $2["entity_id"]) :));
    if (!objectp(primary) || environment(primary) != environment(me) ||
        !gmcp_entity_is_visible(primary))
        primary = sizeof(enemies) ? enemies[0] : 0;

    return ([
        "version"   : GMCP_STATE_VERSION,
        "snapshot"  : 1,
        "revision"  : gmcp_combat_revision,
        "sequence"  : gmcp_combat_revision,
        "in_combat" : sizeof(targets) > 0,
        "busy"      : me->is_busy() ? 1 : 0,
        "can_act"   : !me->is_busy() && living(me) &&
                      !(function_exists("is_ghost", me) && me->is_ghost()),
        "targets"   : targets,
        "primary_target": objectp(primary) &&
                          environment(primary) == environment(me) &&
                          gmcp_entity_is_visible(primary)
                          ? query_gmcp_entity_id(primary) : "",
    ]);
}

private mixed *gmcp_action_files(string skill, string directory)
{
    mixed *names;

    if (directory != "" && directory != "perform/" &&
        directory != "exert/")
        return ({});
    if (!gmcp_safe_skill_id(skill))
        return ({});
    if (catch(names = call_other(GMCP_ACTION_D, "query_action_names",
                                 skill, directory)) || !pointerp(names))
        return ({});
    return names;
}

private string gmcp_combat_action_target_mode(string kind, string name)
{
    if (kind == "fight" || kind == "kill")
        return "required";
    if (kind == "exert")
    {
        // These force methods are explicitly self-only (or have no meaningful
        // target parameter) in their original exert implementations.
        if (member_array(name, ({
                "power", "powerup", "recover", "regenerate", "heal",
                "inspire", "roar", "tianmo", "shield", "resurrect",
                "xun",
            })) != -1)
            return "none";
        // These methods reject a missing/self target in their original code.
        if (member_array(name, ({"lifeheal", "shot"})) != -1)
            return "required";
    }
    // Skill-specific actions are intentionally conservative: the command
    // entry resolves an exact object, while the action source retains the
    // native default-target behavior when no object is supplied.
    return "optional";
}

private mixed *gmcp_combat_action_target_types(string target_mode)
{
    if (target_mode == "none")
        return ({});
    return ({"npc", "player"});
}

private mixed *gmcp_combat_actions()
{
    mapping skill_map;
    mapping seen;
    mixed *records;
    mixed *names;
    string *slots;
    string slot;
    string skill;
    string name;
    string action_id;
    string target_mode;
    object room;
    object *nearby;
    int can_fight;
    int can_kill;
    int i;
    int j;

    skill_map = this_object()->query_skill_map();
    if (!mapp(skill_map))
        skill_map = ([]);
    records = ({});
    seen = ([]);
    slots = sort_array(keys(skill_map), (: strcmp :));

    for (i = 0; i < sizeof(slots); i++)
    {
        slot = slots[i];
        skill = skill_map[slot];
        if (!gmcp_safe_skill_id(slot) || !gmcp_safe_skill_id(skill) ||
            this_object()->query_skill(skill, 1) < 1)
            continue;
        names = gmcp_action_files(skill, "perform/");
        names += gmcp_action_files(skill, "");
        foreach (name in names)
        {
            action_id = "perform:" + slot + ":" + name;
            if (seen[action_id])
                continue;
            seen[action_id] = 1;
            target_mode = gmcp_combat_action_target_mode("perform", name);
            records += ({([
                "action_id"      : action_id,
                "label"          : gmcp_skill_name(skill) + "·" + name,
                "kind"           : "perform",
                "requires_target": target_mode == "required",
                "target_mode"    : target_mode,
                "target_types"   : gmcp_combat_action_target_types(target_mode),
            ])});
        }
    }

    skill = skill_map["force"];
    if (gmcp_safe_skill_id(skill) && this_object()->query_skill(skill, 1) > 0)
    {
        names = gmcp_action_files(skill, "exert/");
        names += gmcp_action_files(skill, "");
        names += gmcp_action_files("force", "");
        foreach (name in names)
        {
            action_id = "exert:force:" + name;
            if (seen[action_id])
                continue;
            seen[action_id] = 1;
            target_mode = gmcp_combat_action_target_mode("exert", name);
            records += ({([
                "action_id"      : action_id,
                "label"          : gmcp_skill_name(skill) + "·" + name,
                "kind"           : "exert",
                "requires_target": target_mode == "required",
                "target_mode"    : target_mode,
                "target_types"   : gmcp_combat_action_target_types(target_mode),
            ])});
        }
    }

    room = environment(this_object());
    nearby = objectp(room) ? all_inventory(room) : ({});
    for (j = 0; j < sizeof(nearby); j++)
    {
        if (gmcp_entity_type(nearby[j]) != "npc" &&
            gmcp_entity_type(nearby[j]) != "player")
            continue;
        if (!can_fight && gmcp_entity_action_available(nearby[j], "fight"))
            can_fight = 1;
        if (!can_kill && gmcp_entity_action_available(nearby[j], "kill"))
            can_kill = 1;
        if (can_fight && can_kill)
            break;
    }
    if (can_fight)
        records += ({([
            "action_id"      : "fight",
            "label"          : "切磋",
            "kind"           : "fight",
            "requires_target": 1,
            "target_mode"    : "required",
            "target_types"   : ({"npc", "player"}),
        ])});
    if (can_kill)
        records += ({([
            "action_id"      : "kill",
            "label"          : "攻击",
            "kind"           : "kill",
            "requires_target": 1,
            "target_mode"    : "required",
            "target_types"   : ({"npc", "player"}),
        ])});

    return sort_array(records, (: strcmp($1["action_id"], $2["action_id"]) :));
}

private mapping gmcp_combat_actions_snapshot()
{
    return ([
        "version" : GMCP_STATE_VERSION,
        "snapshot": 1,
        "revision": gmcp_combat_actions_revision,
        "sequence": gmcp_combat_actions_revision,
        "actions" : gmcp_combat_actions(),
    ]);
}

varargs void gmcp_refresh_vitals(int force)
{
    mapping vitals;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Char.Vitals")))
        return;
    vitals = gmcp_vitals_snapshot();
    fingerprint = gmcp_state_fingerprint(vitals);
    if (!force && fingerprint == gmcp_vitals_fingerprint)
        return;
    if (fingerprint != gmcp_vitals_fingerprint)
        gmcp_vitals_revision++;
    vitals["revision"] = gmcp_vitals_revision;
    vitals["sequence"] = gmcp_vitals_revision;
    sendGMCP(vitals, "Char", "Vitals");
    gmcp_vitals_fingerprint = fingerprint;
}

varargs void gmcp_refresh_status(int force)
{
    mapping status;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Char.Status")))
        return;
    status = gmcp_status_snapshot();
    fingerprint = gmcp_state_fingerprint(status);
    if (!force && fingerprint == gmcp_status_fingerprint)
        return;
    if (fingerprint != gmcp_status_fingerprint)
        gmcp_status_revision++;
    status["revision"] = gmcp_status_revision;
    status["sequence"] = gmcp_status_revision;
    sendGMCP(status, "Char", "Status");
    gmcp_status_fingerprint = fingerprint;
}

varargs void gmcp_refresh_combat(int force)
{
    mapping combat;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Combat.State")))
        return;
    combat = gmcp_combat_snapshot();
    fingerprint = gmcp_state_fingerprint(combat);
    if (!force && fingerprint == gmcp_combat_fingerprint)
        return;
    if (fingerprint != gmcp_combat_fingerprint)
        gmcp_combat_revision++;
    combat["revision"] = gmcp_combat_revision;
    combat["sequence"] = gmcp_combat_revision;
    sendGMCP(combat, "Combat", "State");
    gmcp_combat_fingerprint = fingerprint;
}

varargs void gmcp_refresh_skills(int force)
{
    mapping skills;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Char.Skills")))
        return;
    skills = gmcp_skills_snapshot();
    fingerprint = gmcp_snapshot_fingerprint(skills["skills"]);
    if (!force && fingerprint == gmcp_skills_fingerprint)
        return;
    if (fingerprint != gmcp_skills_fingerprint)
        gmcp_skills_revision++;
    skills["revision"] = gmcp_skills_revision;
    skills["sequence"] = gmcp_skills_revision;
    sendGMCP(skills, "Char", "Skills");
    gmcp_skills_fingerprint = fingerprint;
}

varargs void gmcp_refresh_combat_actions(int force)
{
    mapping actions;
    string fingerprint;

    if (!has_gmcp() || (!force && !gmcp_supports("Combat.Actions")))
        return;
    actions = gmcp_combat_actions_snapshot();
    fingerprint = gmcp_snapshot_fingerprint(actions["actions"]);
    if (!force && fingerprint == gmcp_combat_actions_fingerprint)
        return;
    if (fingerprint != gmcp_combat_actions_fingerprint)
        gmcp_combat_actions_revision++;
    actions["revision"] = gmcp_combat_actions_revision;
    actions["sequence"] = gmcp_combat_actions_revision;
    sendGMCP(actions, "Combat", "Actions");
    gmcp_combat_actions_fingerprint = fingerprint;
}

void gmcp_flush_realtime_refresh()
{
    int vitals;
    int status;
    int combat;
    int skills;
    int actions;

    vitals = gmcp_vitals_refresh_pending;
    status = gmcp_status_refresh_pending;
    combat = gmcp_combat_refresh_pending;
    skills = gmcp_skills_refresh_pending;
    actions = gmcp_combat_actions_refresh_pending;
    gmcp_vitals_refresh_pending = 0;
    gmcp_status_refresh_pending = 0;
    gmcp_combat_refresh_pending = 0;
    gmcp_skills_refresh_pending = 0;
    gmcp_combat_actions_refresh_pending = 0;
    if (vitals)
        gmcp_refresh_vitals();
    if (status)
        gmcp_refresh_status();
    if (combat)
        gmcp_refresh_combat();
    if (skills)
        gmcp_refresh_skills();
    if (actions)
        gmcp_refresh_combat_actions();
}

void gmcp_vitals_changed()
{
    if (!has_gmcp() || gmcp_vitals_refresh_pending)
        return;
    gmcp_vitals_refresh_pending = 1;
    call_out("gmcp_flush_realtime_refresh", 0);
}

void gmcp_status_changed()
{
    if (!has_gmcp() || gmcp_status_refresh_pending)
        return;
    gmcp_status_refresh_pending = 1;
    call_out("gmcp_flush_realtime_refresh", 0);
}

void gmcp_combat_changed()
{
    if (!has_gmcp() || gmcp_combat_refresh_pending)
        return;
    gmcp_combat_refresh_pending = 1;
    call_out("gmcp_flush_realtime_refresh", 0);
}

void gmcp_skills_changed()
{
    if (!has_gmcp() || gmcp_skills_refresh_pending)
        return;
    gmcp_skills_refresh_pending = 1;
    gmcp_status_changed();
    gmcp_combat_actions_changed();
    call_out("gmcp_flush_realtime_refresh", 0);
}

void gmcp_combat_actions_changed()
{
    if (!has_gmcp() || gmcp_combat_actions_refresh_pending)
        return;
    gmcp_combat_actions_refresh_pending = 1;
    call_out("gmcp_flush_realtime_refresh", 0);
}

void gmcp_poll_realtime_state()
{
    gmcp_realtime_polling = 0;
    if (!interactive(this_object()) || !has_gmcp())
        return;
    // Vitals/status/combat are low-cost real-time snapshots. Skills remain
    // event-driven; actions are recomputed only when a state change is seen.
    gmcp_refresh_vitals();
    gmcp_refresh_status();
    gmcp_refresh_combat();
    gmcp_realtime_polling = 1;
    call_out("gmcp_poll_realtime_state", 1);
}

private void gmcp_start_realtime_poll()
{
    if (!interactive(this_object()) || !has_gmcp() || gmcp_realtime_polling)
        return;
    if (!gmcp_supports("Char.Vitals") && !gmcp_supports("Char.Status") &&
        !gmcp_supports("Combat.State"))
        return;
    gmcp_realtime_polling = 1;
    call_out("gmcp_poll_realtime_state", 1);
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
    call_out("gmcp_poll_room_entities", GMCP_ENTITY_POLL_INTERVAL);
}

private void gmcp_start_room_entity_poll()
{
    if (!interactive(this_object()) || !has_gmcp() ||
        !gmcp_supports("Room.Entities") ||
        gmcp_entities_polling)
        return;

    gmcp_entities_polling = 1;
    call_out("gmcp_poll_room_entities", GMCP_ENTITY_POLL_INTERVAL);
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
    gmcp_status_changed();
    gmcp_combat_actions_changed();
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

private void gmcp_reset_session_state()
{
    remove_call_out("gmcp_flush_realtime_refresh");
    remove_call_out("gmcp_poll_realtime_state");
    remove_call_out("gmcp_poll_room_entities");
    remove_call_out("gmcp_flush_room_entity_refresh");
    remove_call_out("gmcp_flush_item_refresh");
    remove_call_out("gmcp_flush_quest_refresh");
    remove_call_out("gmcp_poll_quest_state");
    remove_call_out("gmcp_flush_chat_capabilities");
    remove_call_out("gmcp_poll_chat_capabilities");

    gmcp_room_ids = ([]);
    gmcp_room_session = 0;
    gmcp_room_sequence = 0;
    gmcp_item_ids = ([]);
    gmcp_item_session = 0;
    gmcp_item_sequence = 0;
    gmcp_inventory_revision = 0;
    gmcp_equipment_revision = 0;
    gmcp_inventory_fingerprint = 0;
    gmcp_equipment_fingerprint = 0;
    gmcp_entity_ids = ([]);
    gmcp_entity_session = 0;
    gmcp_entity_sequence = 0;
    gmcp_entities_revision = 0;
    gmcp_entities_fingerprint = 0;
    gmcp_vitals_revision = 0;
    gmcp_status_revision = 0;
    gmcp_combat_revision = 0;
    gmcp_skills_revision = 0;
    gmcp_combat_actions_revision = 0;
    gmcp_vitals_fingerprint = 0;
    gmcp_status_fingerprint = 0;
    gmcp_combat_fingerprint = 0;
    gmcp_skills_fingerprint = 0;
    gmcp_combat_actions_fingerprint = 0;
    gmcp_inventory_refresh_pending = 0;
    gmcp_equipment_refresh_pending = 0;
    gmcp_entities_refresh_pending = 0;
    gmcp_entities_polling = 0;
    gmcp_vitals_refresh_pending = 0;
    gmcp_status_refresh_pending = 0;
    gmcp_combat_refresh_pending = 0;
    gmcp_skills_refresh_pending = 0;
    gmcp_combat_actions_refresh_pending = 0;
    gmcp_realtime_polling = 0;
    gmcp_quest_ids = ([]);
    gmcp_quest_session = 0;
    gmcp_quest_sequence = 0;
    gmcp_quest_revision = 0;
    gmcp_quest_fingerprint = 0;
    gmcp_quest_refresh_pending = 0;
    gmcp_quest_polling = 0;
    gmcp_chat_session = 0;
    gmcp_chat_sequence = 0;
    gmcp_chat_polling = 0;
    gmcp_chat_capabilities_revision = 0;
    gmcp_chat_capabilities_fingerprint = 0;
    gmcp_chat_capabilities_refresh_pending = 0;
    gmcp_support_versions = ([]);
    gmcp_client_info = ([]);
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
            "Char.Status"    : GMCP_STATE_VERSION,
            "Room.Info"      : 1,
            "Room.Entities"  : GMCP_ENTITIES_VERSION,
            "Char.Inventory" : GMCP_ITEMS_VERSION,
            "Char.Equipment": GMCP_ITEMS_VERSION,
            "Char.Skills"    : GMCP_STATE_VERSION,
            "Combat.State"   : GMCP_STATE_VERSION,
            "Combat.Actions" : GMCP_STATE_VERSION,
            "Quest.List"     : GMCP_QUEST_VERSION,
            "Chat.Message"   : GMCP_CHAT_VERSION,
            "Chat.Capabilities": GMCP_CHAT_VERSION,
        ]),
    ]), "Server", "Hello");
}

protected void init_gmcp()
{
    if (!has_gmcp())
        return;
    gmcp_reset_session_state();
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

    gmcp_reset_session_state();
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

private int gmcp_combat_target_allowed(object target, string action_kind)
{
    string type;

    if (!objectp(target) || target == this_object() ||
        environment(target) != environment(this_object()) ||
        !gmcp_entity_is_visible(target) ||
        (!living(target) && action_kind != "kill") ||
        gmcp_entity_is_corpse(target))
        return 0;
    type = gmcp_entity_type(target);
    return type == "npc" || type == "player";
}

private int gmcp_combat_target_type_allowed(mapping action, object target)
{
    mixed *target_types;
    string type;
    string action_kind;

    if (!mapp(action))
        return 0;
    action_kind = action["kind"];
    if (!gmcp_combat_target_allowed(target, action_kind))
        return 0;
    target_types = action["target_types"];
    if (!pointerp(target_types) || sizeof(target_types) == 0)
        return 1;
    type = gmcp_entity_type(target);
    return member_array(type, target_types) != -1;
}

private void gmcp_write_native_action_failure(string fallback)
{
    string message;

    message = "";
    catch(message = query_notify_fail());
    if (!stringp(message) || message == "")
        message = fallback;
    if (strsrch(message, "\n") == -1)
        message += "\n";
    write(message);
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

private int gmcp_enable_slot_allowed(string slot)
{
    return member_array(slot, ({
        "unarmed", "sword", "blade", "staff", "hammer", "club",
        "throwing", "force", "parry", "dodge", "magic", "whip",
        "dagger", "finger", "hand", "cuff", "claw", "strike",
        "medical", "poison", "cooking", "chuixiao-jifa",
        "guzheng-jifa", "tanqin-jifa",
    })) != -1;
}

private int gmcp_skill_owned(string skill)
{
    mapping skills;

    if (!gmcp_safe_skill_id(skill))
        return 0;
    skills = this_object()->query_skills();
    return mapp(skills) && intp(skills[skill]) && skills[skill] > 0;
}

private void gmcp_skill_action_failed(string message)
{
    write(message + "\n");
    gmcp_refresh_skills(1);
    gmcp_refresh_status(1);
    gmcp_refresh_combat_actions(1);
}

private void gmcp_handle_web_skill_action(string payload)
{
    mixed decoded;
    mapping data;
    string skill;
    string action;
    string slot;
    mixed valid_enable;
    mixed valid_enable_error;
    mixed result;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_skill_action_failed("技能操作请求无效。" );
        return;
    }
    data = decoded;
    skill = data["skill_id"];
    action = data["action"];
    slot = data["slot"];
    if (!gmcp_skill_owned(skill) ||
        (action != "enable" && action != "prepare"))
    {
        gmcp_skill_action_failed("技能操作不被允许。" );
        return;
    }
    if (this_object()->is_busy())
    {
        gmcp_skill_action_failed("你正忙于上一个动作，暂时无法修改技能状态。" );
        return;
    }

    if (action == "enable")
    {
        valid_enable = 0;
        valid_enable_error = 0;
        if (!stringp(slot) || !gmcp_enable_slot_allowed(slot) ||
            !gmcp_skill_owned(slot) ||
            ((valid_enable_error =
              catch(valid_enable = SKILL_D(skill)->valid_enable(slot))) == 0 &&
             !valid_enable))
        {
            gmcp_skill_action_failed("该技能当前不能激发到这个用途。" );
            return;
        }
        if (catch(result = call_other("/cmds/skill/enable", "main",
                                      this_object(), slot + " " + skill)))
        {
            gmcp_skill_action_failed("技能激发失败，请查看当前状态。" );
            return;
        }
    }
    else
    {
        if (slot)
        {
            gmcp_skill_action_failed("准备技能不接受额外用途参数。" );
            return;
        }
        if (catch(result = call_other("/cmds/skill/prepare", "main",
                                      this_object(), skill)))
        {
            gmcp_skill_action_failed("技能准备失败，请查看当前状态。" );
            return;
        }
    }

    if (!result)
        write("技能操作未能完成，请查看原有游戏文字。\n");
    gmcp_skills_changed();
}

private mapping gmcp_find_combat_action(string action_id)
{
    mixed *actions;
    mapping action;
    int i;

    if (!stringp(action_id) || strlen(action_id) > 160 ||
        strsrch(action_id, "\n") != -1 || strsrch(action_id, "\r") != -1)
        return 0;
    actions = gmcp_combat_actions();
    for (i = 0; i < sizeof(actions); i++)
    {
        action = actions[i];
        if (mapp(action) && action["action_id"] == action_id)
            return action;
    }
    return 0;
}

private void gmcp_combat_action_failed(string message)
{
    write(message + "\n");
    gmcp_refresh_combat(1);
    gmcp_refresh_combat_actions(1);
}

private void gmcp_handle_web_combat_action(string payload)
{
    mixed decoded;
    mapping data;
    mapping action;
    object target;
    string action_id;
    string target_entity_id;
    string target_mode;
    string *parts;
    mixed *request_keys;
    mixed result;
    int has_target;
    int i;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_combat_action_failed("战斗操作请求无效。" );
        return;
    }
    data = decoded;
    action_id = data["action_id"];
    request_keys = keys(data);
    for (i = 0; i < sizeof(request_keys); i++)
    {
        if (!stringp(request_keys[i]) ||
            (request_keys[i] != "action_id" &&
             request_keys[i] != "target_entity_id"))
        {
            gmcp_combat_action_failed("战斗操作请求包含不被允许的字段。" );
            return;
        }
    }
    has_target = !undefinedp(data["target_entity_id"]);
    target_entity_id = data["target_entity_id"];
    action = gmcp_find_combat_action(action_id);
    if (!mapp(action))
    {
        gmcp_combat_action_failed("该战斗动作当前不可用。" );
        return;
    }
    if (this_object()->is_busy())
    {
        gmcp_combat_action_failed("你正忙于上一个动作，暂时无法执行战斗操作。" );
        return;
    }

    target_mode = action["target_mode"];
    if (!stringp(target_mode))
        target_mode = action["requires_target"] ? "required" : "optional";
    if (target_mode != "none" && target_mode != "optional" &&
        target_mode != "required")
    {
        gmcp_combat_action_failed("该战斗动作的目标能力无效。" );
        return;
    }
    if (has_target && (!stringp(target_entity_id) ||
                       !gmcp_safe_entity_id(target_entity_id)))
    {
        gmcp_combat_action_failed("战斗操作目标无效。" );
        return;
    }
    if (target_mode == "required" && !has_target)
    {
        gmcp_combat_action_failed("这个战斗动作需要附近目标。" );
        return;
    }
    if (target_mode == "none" && has_target)
    {
        gmcp_combat_action_failed("当前战斗动作不接受目标。" );
        return;
    }

    if (has_target)
    {
        target = gmcp_find_entity(target_entity_id);
        if (!gmcp_combat_target_type_allowed(action, target))
        {
            gmcp_combat_action_failed("该目标已经不在附近或不能执行这个动作。" );
            return;
        }
        if (action["kind"] == "fight" || action["kind"] == "kill")
        {
            if (!gmcp_entity_action_available(target, action["kind"]))
            {
                gmcp_combat_action_failed("该目标已经不在附近或不能执行这个动作。" );
                return;
            }
            notify_fail("");
            result = gmcp_run_entity_action(target, action["kind"], "");
        }
        else if (action["kind"] == "perform")
        {
            parts = explode(action_id, ":");
            if (sizeof(parts) != 3)
            {
                gmcp_combat_action_failed("该战斗动作当前不可用。" );
                return;
            }
            notify_fail("");
            if (catch(result = call_other("/cmds/skill/perform",
                                          "do_perform_target", this_object(),
                                          parts[1], parts[2], target)))
            {
                gmcp_combat_action_failed("外功施展失败，请查看当前状态。" );
                return;
            }
        }
        else if (action["kind"] == "exert")
        {
            parts = explode(action_id, ":");
            if (sizeof(parts) != 3 || parts[1] != "force")
            {
                gmcp_combat_action_failed("该战斗动作当前不可用。" );
                return;
            }
            notify_fail("");
            if (catch(result = call_other("/cmds/skill/exert",
                                          "do_exert_target", this_object(),
                                          parts[2], target)))
            {
                gmcp_combat_action_failed("内功施展失败，请查看当前状态。" );
                return;
            }
        }
        else if (action["kind"] != "perform" && action["kind"] != "exert")
        {
            gmcp_combat_action_failed("该战斗动作当前不可用。" );
            return;
        }
    }
    else if (action["kind"] == "perform")
    {
        parts = explode(action_id, ":");
        if (sizeof(parts) != 3)
        {
            gmcp_combat_action_failed("该战斗动作当前不可用。" );
            return;
        }
        notify_fail("");
        if (catch(result = call_other("/cmds/skill/perform", "do_perform_target",
                                      this_object(), parts[1], parts[2], 0)))
        {
            gmcp_combat_action_failed("外功施展失败，请查看当前状态。" );
            return;
        }
    }
    else if (action["kind"] == "exert")
    {
        parts = explode(action_id, ":");
        if (sizeof(parts) != 3 || parts[1] != "force")
        {
            gmcp_combat_action_failed("该战斗动作当前不可用。" );
            return;
        }
        notify_fail("");
        if (catch(result = call_other("/cmds/skill/exert", "do_exert_target",
                                      this_object(), parts[2], 0)))
        {
            gmcp_combat_action_failed("内功施展失败，请查看当前状态。" );
            return;
        }
    }
    else
    {
        gmcp_combat_action_failed("该战斗动作当前不可用。" );
        return;
    }

    if (!result)
        gmcp_write_native_action_failure("战斗动作未能完成，请查看原有游戏文字。");
    gmcp_vitals_changed();
    gmcp_status_changed();
    gmcp_combat_changed();
    gmcp_combat_actions_changed();
}

private int gmcp_safe_chat_channel(string value)
{
    int i;

    if (!stringp(value) || value == "" || strlen(value) > 32)
        return 0;
    for (i = 0; i < strlen(value); i++)
    {
        if ((value[i] >= 'a' && value[i] <= 'z') ||
            (value[i] >= '0' && value[i] <= '9') ||
            value[i] == '-' || value[i] == '_')
            continue;
        return 0;
    }
    return 1;
}

private int gmcp_chat_request_key_allowed(string kind, string key)
{
    if (!stringp(kind) || !stringp(key))
        return 0;
    if (key == "kind" || key == "text")
        return 1;
    if (kind == "tell" && key == "target_entity_id")
        return 1;
    if (kind == "channel" && (key == "channel" || key == "emote"))
        return 1;
    return 0;
}

private void gmcp_handle_web_chat_send(string payload)
{
    mixed decoded;
    mapping data;
    mixed *request_keys;
    object target;
    string kind;
    string text;
    string target_entity_id;
    string target_id;
    string channel;
    mixed result;
    mixed value;
    int emote;
    int i;

    if (catch(decoded = json_decode(payload)) || !mapp(decoded))
    {
        gmcp_write_native_action_failure("聊天请求无效。");
        return;
    }
    data = decoded;
    kind = data["kind"];
    if (!stringp(kind) || (kind != "say" && kind != "tell" &&
                           kind != "reply" && kind != "channel"))
    {
        gmcp_write_native_action_failure("聊天类型不被允许。");
        return;
    }
    request_keys = keys(data);
    for (i = 0; i < sizeof(request_keys); i++)
    {
        if (!stringp(request_keys[i]) ||
            !gmcp_chat_request_key_allowed(kind, request_keys[i]))
        {
            gmcp_write_native_action_failure("聊天请求包含不被允许的字段。");
            return;
        }
    }

    text = gmcp_entity_request_text(data["text"], 1,
                                    GMCP_CHAT_TEXT_LIMIT);
    if (!stringp(text))
    {
        gmcp_write_native_action_failure("聊天内容无效。");
        return;
    }

    if (kind == "say")
    {
        notify_fail("");
        if (catch(result = call_other("/cmds/std/say", "main",
                                      this_object(), text)))
        {
            gmcp_write_native_action_failure("说话失败，请查看原有游戏文字。");
            return;
        }
    }
    else if (kind == "reply")
    {
        notify_fail("");
        if (catch(result = call_other("/cmds/std/reply", "main",
                                      this_object(), text)))
        {
            gmcp_write_native_action_failure("回复失败，请查看原有游戏文字。");
            return;
        }
    }
    else if (kind == "tell")
    {
        target_entity_id = data["target_entity_id"];
        if (!stringp(target_entity_id) ||
            !gmcp_safe_entity_id(target_entity_id))
        {
            gmcp_write_native_action_failure("聊天目标无效。");
            return;
        }
        target = gmcp_find_entity(target_entity_id);
        if (!objectp(target) || gmcp_entity_type(target) != "player" ||
            catch(target_id = target->query("id")) ||
            !stringp(target_id) || target_id == "" ||
            strlen(target_id) > 128 || strsrch(target_id, "\n") != -1 ||
            strsrch(target_id, "\r") != -1)
        {
            gmcp_write_native_action_failure("聊天目标已经不在附近了。");
            return;
        }
        notify_fail("");
        if (catch(result = call_other("/cmds/std/tell", "main",
                                      this_object(), target_id + " " + text)))
        {
            gmcp_write_native_action_failure("私聊失败，请查看原有游戏文字。");
            return;
        }
    }
    else
    {
        channel = data["channel"];
        if (!gmcp_safe_chat_channel(channel))
        {
            gmcp_write_native_action_failure("频道无效。");
            return;
        }
        if (catch(value = CHANNEL_D->query_web_channel(this_object(),
                                                       channel)) || !value)
        {
            gmcp_write_native_action_failure("你当前不能使用这个频道。");
            return;
        }
        emote = data["emote"];
        if (undefinedp(emote))
            emote = 0;
        if (!intp(emote) || (emote != 0 && emote != 1))
        {
            gmcp_write_native_action_failure("频道消息类型无效。");
            return;
        }
        notify_fail("");
        if (catch(result = CHANNEL_D->do_channel(this_object(), channel,
                                                 text, emote)))
        {
            gmcp_write_native_action_failure("频道消息发送失败，请查看原有游戏文字。");
            return;
        }
    }

    if (!result)
        gmcp_write_native_action_failure("消息未能发送，请查看原有游戏文字。");
    gmcp_chat_capabilities_changed();
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
        gmcp_reset_session_state();
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
            gmcp_start_realtime_poll();
            gmcp_start_quest_poll();
            gmcp_start_chat_capability_poll();
        }
    }
    else if (package == "Char.Vitals.Get")
    {
        gmcp_refresh_vitals(1);
    }
    else if (package == "Char.Status.Get")
    {
        gmcp_refresh_status(1);
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
    else if (package == "Char.Skills.Get")
    {
        gmcp_refresh_skills(1);
    }
    else if (package == "Combat.State.Get")
    {
        gmcp_refresh_combat(1);
    }
    else if (package == "Combat.Actions.Get")
    {
        gmcp_refresh_combat_actions(1);
    }
    else if (package == "Quest.List.Get")
    {
        gmcp_refresh_quests(1);
        gmcp_start_quest_poll();
    }
    else if (package == "Chat.Capabilities.Get")
    {
        gmcp_refresh_chat_capabilities(1);
        gmcp_start_chat_capability_poll();
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
    else if (package == "Web.Skill.Action")
    {
        gmcp_handle_web_skill_action(payload);
    }
    else if (package == "Web.Combat.Action")
    {
        gmcp_handle_web_combat_action(payload);
    }
    else if (package == "Web.Chat.Send")
    {
        gmcp_handle_web_chat_send(payload);
    }
}
