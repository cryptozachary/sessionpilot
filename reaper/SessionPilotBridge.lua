-- SessionPilot Bridge for REAPER
-- This ReaScript polls for commands from the SessionPilot web app
-- and executes them against the REAPER API.
--
-- SETUP:
-- 1. Install this script in REAPER (Actions > Show action list > Load ReaScript)
-- 2. Set the bridge paths below to match your SessionPilot installation
-- 3. Run the script — it will keep running in the background

-- Configuration
local _, SCRIPT_PATH = reaper.get_action_context()
local SCRIPT_DIR = SCRIPT_PATH:match("^(.*[\\/])") or (reaper.GetResourcePath() .. "/Scripts/")
local BRIDGE_DIR = (SCRIPT_DIR .. "../reaper_bridge/"):gsub("\\", "/")
local COMMAND_DIR = BRIDGE_DIR .. "commands/"
local RESULT_DIR = BRIDGE_DIR .. "results/"
local STATE_FILE = BRIDGE_DIR .. "state.json"
local POLL_INTERVAL = 0.1  -- seconds
local STATE_INTERVAL = 1.0 -- seconds between state snapshots

---------------------------------------------------------------------------
-- Utility: JSON encoder (minimal, no external deps)
---------------------------------------------------------------------------
local function jsonEncode(val)
  local t = type(val)

  if val == nil then
    return "null"
  elseif t == "boolean" then
    return val and "true" or "false"
  elseif t == "number" then
    if val ~= val then return "null" end -- NaN
    if val == math.huge or val == -math.huge then return "null" end
    -- Use integer formatting when the value has no fractional part
    if val == math.floor(val) and math.abs(val) < 1e15 then
      return string.format("%d", val)
    end
    return tostring(val)
  elseif t == "string" then
    -- Escape special characters
    local escaped = val:gsub('\\', '\\\\')
                       :gsub('"', '\\"')
                       :gsub('\n', '\\n')
                       :gsub('\r', '\\r')
                       :gsub('\t', '\\t')
                       :gsub('[%z\1-\31]', function(c)
                         return string.format('\\u%04x', string.byte(c))
                       end)
    return '"' .. escaped .. '"'
  elseif t == "table" then
    -- Determine if the table is an array or an object
    local isArray = true
    local maxIndex = 0
    local count = 0
    for k, _ in pairs(val) do
      count = count + 1
      if type(k) == "number" and k == math.floor(k) and k >= 1 then
        if k > maxIndex then maxIndex = k end
      else
        isArray = false
        break
      end
    end
    if count == 0 then
      -- Empty table: default to array
      return "[]"
    end
    if isArray and maxIndex == count then
      -- Encode as array
      local parts = {}
      for i = 1, maxIndex do
        parts[i] = jsonEncode(val[i])
      end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      -- Encode as object
      local parts = {}
      -- Sort keys for deterministic output
      local keys = {}
      for k, _ in pairs(val) do
        keys[#keys + 1] = k
      end
      table.sort(keys, function(a, b)
        return tostring(a) < tostring(b)
      end)
      for _, k in ipairs(keys) do
        local encodedKey = jsonEncode(tostring(k))
        local encodedVal = jsonEncode(val[k])
        parts[#parts + 1] = encodedKey .. ":" .. encodedVal
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  else
    return "null"
  end
end

---------------------------------------------------------------------------
-- Utility: JSON decoder (minimal)
---------------------------------------------------------------------------
local function jsonDecode(str)
  if not str or str == "" then return nil end

  local pos = 1
  local len = #str

  local function skipWhitespace()
    while pos <= len do
      local c = str:sub(pos, pos)
      if c == " " or c == "\t" or c == "\n" or c == "\r" then
        pos = pos + 1
      else
        break
      end
    end
  end

  local function peek()
    skipWhitespace()
    return str:sub(pos, pos)
  end

  local parseValue -- forward declaration

  local function parseString()
    -- pos should be on the opening quote
    if str:sub(pos, pos) ~= '"' then return nil end
    pos = pos + 1
    local parts = {}
    while pos <= len do
      local c = str:sub(pos, pos)
      if c == '"' then
        pos = pos + 1
        return table.concat(parts)
      elseif c == '\\' then
        pos = pos + 1
        local esc = str:sub(pos, pos)
        if esc == '"' then parts[#parts + 1] = '"'
        elseif esc == '\\' then parts[#parts + 1] = '\\'
        elseif esc == '/' then parts[#parts + 1] = '/'
        elseif esc == 'n' then parts[#parts + 1] = '\n'
        elseif esc == 'r' then parts[#parts + 1] = '\r'
        elseif esc == 't' then parts[#parts + 1] = '\t'
        elseif esc == 'b' then parts[#parts + 1] = '\b'
        elseif esc == 'f' then parts[#parts + 1] = '\f'
        elseif esc == 'u' then
          local hex = str:sub(pos + 1, pos + 4)
          local codepoint = tonumber(hex, 16)
          if codepoint then
            if codepoint < 128 then
              parts[#parts + 1] = string.char(codepoint)
            elseif codepoint < 2048 then
              parts[#parts + 1] = string.char(
                192 + math.floor(codepoint / 64),
                128 + (codepoint % 64)
              )
            else
              parts[#parts + 1] = string.char(
                224 + math.floor(codepoint / 4096),
                128 + math.floor((codepoint % 4096) / 64),
                128 + (codepoint % 64)
              )
            end
          end
          pos = pos + 4
        end
        pos = pos + 1
      else
        parts[#parts + 1] = c
        pos = pos + 1
      end
    end
    return nil -- unterminated string
  end

  local function parseNumber()
    local startPos = pos
    if str:sub(pos, pos) == '-' then pos = pos + 1 end
    while pos <= len and str:sub(pos, pos):match('%d') do pos = pos + 1 end
    if pos <= len and str:sub(pos, pos) == '.' then
      pos = pos + 1
      while pos <= len and str:sub(pos, pos):match('%d') do pos = pos + 1 end
    end
    if pos <= len and str:sub(pos, pos):lower() == 'e' then
      pos = pos + 1
      if pos <= len and (str:sub(pos, pos) == '+' or str:sub(pos, pos) == '-') then
        pos = pos + 1
      end
      while pos <= len and str:sub(pos, pos):match('%d') do pos = pos + 1 end
    end
    local numStr = str:sub(startPos, pos - 1)
    return tonumber(numStr)
  end

  local function parseArray()
    pos = pos + 1 -- skip '['
    local arr = {}
    skipWhitespace()
    if str:sub(pos, pos) == ']' then
      pos = pos + 1
      return arr
    end
    while true do
      skipWhitespace()
      local val = parseValue()
      arr[#arr + 1] = val
      skipWhitespace()
      local c = str:sub(pos, pos)
      if c == ',' then
        pos = pos + 1
      elseif c == ']' then
        pos = pos + 1
        return arr
      else
        return arr -- malformed, return what we have
      end
    end
  end

  local function parseObject()
    pos = pos + 1 -- skip '{'
    local obj = {}
    skipWhitespace()
    if str:sub(pos, pos) == '}' then
      pos = pos + 1
      return obj
    end
    while true do
      skipWhitespace()
      local key = parseString()
      if not key then return obj end
      skipWhitespace()
      if str:sub(pos, pos) == ':' then pos = pos + 1 end
      skipWhitespace()
      local val = parseValue()
      obj[key] = val
      skipWhitespace()
      local c = str:sub(pos, pos)
      if c == ',' then
        pos = pos + 1
      elseif c == '}' then
        pos = pos + 1
        return obj
      else
        return obj
      end
    end
  end

  parseValue = function()
    skipWhitespace()
    local c = str:sub(pos, pos)
    if c == '"' then
      return parseString()
    elseif c == '{' then
      return parseObject()
    elseif c == '[' then
      return parseArray()
    elseif c == 't' then
      pos = pos + 4 -- true
      return true
    elseif c == 'f' then
      pos = pos + 5 -- false
      return false
    elseif c == 'n' then
      pos = pos + 4 -- null
      return nil
    elseif c == '-' or c:match('%d') then
      return parseNumber()
    else
      return nil
    end
  end

  return parseValue()
end

---------------------------------------------------------------------------
-- Utility: ensure directory exists
---------------------------------------------------------------------------
local function ensureDir(path)
  reaper.RecursiveCreateDirectory(path, 0)
end

---------------------------------------------------------------------------
-- Utility: read file contents
---------------------------------------------------------------------------
local function readFile(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local content = f:read("*a")
  f:close()
  return content
end

---------------------------------------------------------------------------
-- Utility: write file contents
---------------------------------------------------------------------------
local function writeFile(path, content)
  local f = io.open(path, "w")
  if not f then return false end
  f:write(content)
  f:close()
  return true
end

---------------------------------------------------------------------------
-- Utility: list files in directory
---------------------------------------------------------------------------
local function listFiles(dir)
  local files = {}
  local i = 0
  while true do
    local filename = reaper.EnumerateFiles(dir, i)
    if not filename then break end
    files[#files + 1] = filename
    i = i + 1
  end
  return files
end

---------------------------------------------------------------------------
-- Utility: delete file
---------------------------------------------------------------------------
local function deleteFile(path)
  os.remove(path)
end

---------------------------------------------------------------------------
-- Utility: find track by our ID format "track_N"
---------------------------------------------------------------------------
local function findTrackById(trackId)
  if not trackId or type(trackId) ~= "string" then return nil end
  local idx = tonumber(trackId:match("track_(%d+)"))
  if not idx then return nil end
  return reaper.GetTrack(0, idx)
end

---------------------------------------------------------------------------
-- Utility: convert a bar number into seconds using the project BPM
---------------------------------------------------------------------------
local function barToTime(bar)
  if not bar then return nil end
  local bpm, _ = reaper.GetProjectTimeSignature2(0)
  if bpm == 0 then bpm = 120 end
  return (bar - 1) * (4 * 60 / bpm)
end

---------------------------------------------------------------------------
-- Utility: convert a time position into a 1-based bar number
---------------------------------------------------------------------------
local function timeToBar(timePos)
  if timePos == nil then return nil end

  local _, measures = reaper.TimeMap2_timeToBeats(0, timePos)
  if measures ~= nil then
    return math.floor(measures) + 1
  end

  local bpm, _ = reaper.GetProjectTimeSignature2(0)
  if bpm == 0 then bpm = 120 end
  local beats = (timePos * bpm) / 60
  return math.max(1, math.floor(beats / 4) + 1)
end

---------------------------------------------------------------------------
-- Get project summary
---------------------------------------------------------------------------
local function getProjectSummary()
  local proj = 0 -- current project
  local _, projName = reaper.GetProjectName(proj, "")
  local projPath = reaper.GetProjectPath("")
  local sr = reaper.GetSetProjectInfo(proj, "PROJECT_SRATE", 0, false)
  local bpm, _ = reaper.GetProjectTimeSignature2(proj)
  local playState = reaper.GetPlayState()
  local cursor = reaper.GetCursorPosition()
  local trackCount = reaper.CountTracks(proj)
  local _, numMarkers, numRegions = reaper.CountProjectMarkers(proj)

  local transportLookup = {
    [0] = "stopped",
    [1] = "playing",
    [2] = "paused",
    [5] = "recording",
    [6] = "record_paused"
  }

  return {
    projectName = projName,
    projectPath = projPath,
    sampleRate = sr,
    bpm = bpm,
    transportState = transportLookup[playState] or "unknown",
    playCursor = cursor,
    playCursorBar = timeToBar(cursor),
    recordMode = "normal",
    trackCount = trackCount,
    markerCount = numMarkers,
    regionCount = numRegions
  }
end

---------------------------------------------------------------------------
-- Get track summary for a given track
---------------------------------------------------------------------------
local function getTrackSummary(track, index)
  local _, name = reaper.GetTrackName(track)
  local color = reaper.GetTrackColor(track)
  local isSelected = reaper.IsTrackSelected(track)
  local isMuted = reaper.GetMediaTrackInfo_Value(track, "B_MUTE") == 1
  local isSolo = reaper.GetMediaTrackInfo_Value(track, "I_SOLO") > 0
  local isArmed = reaper.GetMediaTrackInfo_Value(track, "I_RECARM") == 1
  local monitoringOn = reaper.GetMediaTrackInfo_Value(track, "I_RECMON") > 0
  local folderDepth = reaper.GetMediaTrackInfo_Value(track, "I_FOLDERDEPTH")
  local itemCount = reaper.CountTrackMediaItems(track)
  local fxCount = reaper.TrackFX_GetCount(track)

  -- Get FX names
  local fxNames = {}
  for i = 0, fxCount - 1 do
    local _, fxName = reaper.TrackFX_GetFXName(track, i, "")
    table.insert(fxNames, fxName)
  end

  -- Color to hex
  local colorHex = nil
  if color ~= 0 then
    local r = color & 0xFF
    local g = (color >> 8) & 0xFF
    local b = (color >> 16) & 0xFF
    colorHex = string.format("#%02x%02x%02x", r, g, b)
  end

  -- Get record input
  local recInput = reaper.GetMediaTrackInfo_Value(track, "I_RECINPUT")
  local inputLabel = nil
  if recInput >= 0 then
    inputLabel = "Input " .. (recInput + 1)
  end

  return {
    id = "track_" .. index,
    index = index,
    name = name,
    color = colorHex,
    isSelected = isSelected,
    isMuted = isMuted,
    isSolo = isSolo,
    isArmed = isArmed,
    monitoringOn = monitoringOn,
    inputLabel = inputLabel,
    folderDepth = folderDepth,
    fxNames = fxNames,
    itemCount = itemCount
  }
end

---------------------------------------------------------------------------
-- List all tracks
---------------------------------------------------------------------------
local function listTracks()
  local tracks = {}
  for i = 0, reaper.CountTracks(0) - 1 do
    local track = reaper.GetTrack(0, i)
    table.insert(tracks, getTrackSummary(track, i))
  end
  return tracks
end

---------------------------------------------------------------------------
-- Get selected track
---------------------------------------------------------------------------
local function getSelectedTrack()
  local track = reaper.GetSelectedTrack(0, 0)
  if not track then return nil end
  local idx = reaper.GetMediaTrackInfo_Value(track, "IP_TRACKNUMBER") - 1
  return getTrackSummary(track, math.floor(idx))
end

---------------------------------------------------------------------------
-- Get markers and regions
---------------------------------------------------------------------------
local function getMarkersAndRegions()
  local result = { markers = {}, regions = {} }
  local _, numMarkers, numRegions = reaper.CountProjectMarkers(0)
  local total = numMarkers + numRegions
  for i = 0, total - 1 do
    local ok, isRegion, pos, rgnEnd, name, idx = reaper.EnumProjectMarkers(i)
    if ok then
      if isRegion then
        table.insert(result.regions, {
          id = idx,
          name = name,
          start = pos,
          ["end"] = rgnEnd,
          startBar = timeToBar(pos),
          endBar = timeToBar(rgnEnd)
        })
      else
        table.insert(result.markers, {
          id = idx,
          name = name,
          position = pos,
          bar = timeToBar(pos)
        })
      end
    end
  end
  return result
end

---------------------------------------------------------------------------
-- Command handlers
---------------------------------------------------------------------------
local commands = {}

commands.ping = function(args)
  return { ok = true, data = { pong = true } }
end

commands.getProjectSummary = function(args)
  return { ok = true, data = getProjectSummary() }
end

commands.listTracks = function(args)
  return { ok = true, data = listTracks() }
end

commands.getSelectedTrack = function(args)
  local track = getSelectedTrack()
  return { ok = true, data = track }
end

commands.getMarkersAndRegions = function(args)
  return { ok = true, data = getMarkersAndRegions() }
end

commands.getTransportState = function(args)
  local summary = getProjectSummary()
  return {
    ok = true,
    data = {
      state = summary.transportState,
      playCursor = summary.playCursor,
      playCursorBar = summary.playCursorBar,
      bpm = summary.bpm,
      recordMode = summary.recordMode
    }
  }
end

commands.createTrack = function(args)
  local idx = args.insertIndex or reaper.CountTracks(0)
  reaper.InsertTrackAtIndex(idx, true)
  local track = reaper.GetTrack(0, idx)
  if args.name then
    reaper.GetSetMediaTrackInfo_String(track, "P_NAME", args.name, true)
  end
  if args.color then
    local r, g, b = args.color:match("#(%x%x)(%x%x)(%x%x)")
    if r then
      local col = reaper.ColorToNative(tonumber(r, 16), tonumber(g, 16), tonumber(b, 16)) | 0x1000000
      reaper.SetTrackColor(track, col)
    end
  end
  return { ok = true, data = getTrackSummary(track, idx) }
end

commands.renameTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.GetSetMediaTrackInfo_String(track, "P_NAME", args.name, true)
  return { ok = true, data = { trackId = args.trackId, name = args.name } }
end

commands.armTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "I_RECARM", 1)
  return { ok = true, data = { trackId = args.trackId, isArmed = true } }
end

commands.disarmTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "I_RECARM", 0)
  return { ok = true, data = { trackId = args.trackId, isArmed = false } }
end

commands.toggleMonitoring = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  local val = args.enabled and 1 or 0
  reaper.SetMediaTrackInfo_Value(track, "I_RECMON", val)
  return { ok = true, data = { trackId = args.trackId, monitoringOn = args.enabled } }
end

commands.setTrackColor = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  local r, g, b = args.color:match("#(%x%x)(%x%x)(%x%x)")
  if r then
    local col = reaper.ColorToNative(tonumber(r, 16), tonumber(g, 16), tonumber(b, 16)) | 0x1000000
    reaper.SetTrackColor(track, col)
  end
  return { ok = true, data = { trackId = args.trackId, color = args.color } }
end

commands.muteTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "B_MUTE", args.enabled and 1 or 0)
  return { ok = true, data = { trackId = args.trackId, isMuted = args.enabled } }
end

commands.soloTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "I_SOLO", args.enabled and 2 or 0)
  return { ok = true, data = { trackId = args.trackId, isSolo = args.enabled } }
end

commands.selectTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  -- Optionally clear existing selection
  if not args.addToSelection then
    local count = reaper.CountTracks(0)
    for i = 0, count - 1 do
      local t = reaper.GetTrack(0, i)
      reaper.SetTrackSelected(t, false)
    end
  end
  reaper.SetTrackSelected(track, true)
  local idx = tonumber(args.trackId:match("track_(%d+)"))
  return { ok = true, data = getTrackSummary(track, idx) }
end

commands.duplicateTrack = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  -- Select only this track, then duplicate via action
  local count = reaper.CountTracks(0)
  for i = 0, count - 1 do
    local t = reaper.GetTrack(0, i)
    reaper.SetTrackSelected(t, false)
  end
  reaper.SetTrackSelected(track, true)
  -- Action 40062: Track: Duplicate tracks
  reaper.Main_OnCommand(40062, 0)
  -- The duplicate is inserted right after the original and is now selected
  local newTrack = reaper.GetSelectedTrack(0, 0)
  if not newTrack then
    return { ok = false, errors = {"Failed to duplicate track"} }
  end
  local newName = args.name or args.newName
  if newName then
    reaper.GetSetMediaTrackInfo_String(newTrack, "P_NAME", newName, true)
  end
  local newIdx = math.floor(reaper.GetMediaTrackInfo_Value(newTrack, "IP_TRACKNUMBER") - 1)
  return { ok = true, data = getTrackSummary(newTrack, newIdx) }
end

commands.createFolderTrack = function(args)
  local idx = args.insertIndex or 0
  reaper.InsertTrackAtIndex(idx, true)
  local folder = reaper.GetTrack(0, idx)
  if args.name then
    reaper.GetSetMediaTrackInfo_String(folder, "P_NAME", args.name, true)
  end
  if args.color then
    local r, g, b = args.color:match("#(%x%x)(%x%x)(%x%x)")
    if r then
      local col = reaper.ColorToNative(tonumber(r, 16), tonumber(g, 16), tonumber(b, 16)) | 0x1000000
      reaper.SetTrackColor(folder, col)
    end
  end
  -- Set as folder parent
  reaper.SetMediaTrackInfo_Value(folder, "I_FOLDERDEPTH", 1)

  -- Create child tracks if requested
  local childCount = args.childCount or 0
  local childNames = args.childNames or {}
  for i = 1, childCount do
    reaper.InsertTrackAtIndex(idx + i, true)
    local child = reaper.GetTrack(0, idx + i)
    local childName = childNames[i]
    if childName then
      reaper.GetSetMediaTrackInfo_String(child, "P_NAME", childName, true)
    end
    -- Last child closes the folder
    if i == childCount then
      reaper.SetMediaTrackInfo_Value(child, "I_FOLDERDEPTH", -1)
    else
      reaper.SetMediaTrackInfo_Value(child, "I_FOLDERDEPTH", 0)
    end
  end

  return { ok = true, data = getTrackSummary(folder, idx) }
end

commands.insertMarker = function(args)
  local pos = args.position
  if pos == nil and args.bar ~= nil then
    pos = barToTime(args.bar)
  end
  if pos == nil then
    pos = reaper.GetCursorPosition()
  end
  local idx = reaper.AddProjectMarker(0, false, pos, 0, args.name or "", -1)
  return {
    ok = true,
    data = {
      markerId = idx,
      position = pos,
      bar = timeToBar(pos),
      name = args.name
    }
  }
end

commands.createRegion = function(args)
  local startPos = args.start
  if startPos == nil and args.startBar ~= nil then
    startPos = barToTime(args.startBar)
  end
  local endPos = args["end"]
  if endPos == nil and args.endBar ~= nil then
    endPos = barToTime(args.endBar)
  end
  local idx = reaper.AddProjectMarker(0, true, startPos, endPos, args.name or "", -1)
  return {
    ok = true,
    data = {
      regionId = idx,
      start = startPos,
      ["end"] = endPos,
      startBar = timeToBar(startPos),
      endBar = timeToBar(endPos),
      name = args.name
    }
  }
end

commands.createSend = function(args)
  local fromTrack = findTrackById(args.fromTrackId)
  if not fromTrack then return { ok = false, errors = {"Source track not found"} } end
  local toTrack = findTrackById(args.toTrackId)
  if not toTrack then return { ok = false, errors = {"Destination track not found"} } end

  local sendIdx = reaper.CreateTrackSend(fromTrack, toTrack)
  if sendIdx < 0 then
    return { ok = false, errors = {"Failed to create send"} }
  end

  -- Set send volume (default 1.0 = unity)
  local vol = args.volume or 1.0
  reaper.SetTrackSendInfo_Value(fromTrack, 0, sendIdx, "D_VOL", vol)

  -- Set send pan (default 0.0 = center)
  local pan = args.pan or 0.0
  reaper.SetTrackSendInfo_Value(fromTrack, 0, sendIdx, "D_PAN", pan)

  -- Set pre/post fader: 0 = post-fader, 1 = pre-fx, 3 = pre-fader
  if args.prePost == "pre" then
    reaper.SetTrackSendInfo_Value(fromTrack, 0, sendIdx, "I_SENDMODE", 3)
  else
    reaper.SetTrackSendInfo_Value(fromTrack, 0, sendIdx, "I_SENDMODE", 0)
  end

  return {
    ok = true,
    data = {
      sendIndex = sendIdx,
      fromTrackId = args.fromTrackId,
      toTrackId = args.toTrackId,
      volume = vol,
      pan = pan,
      prePost = args.prePost or "post"
    }
  }
end

commands.setTrackVolume = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "D_VOL", args.volume)
  return { ok = true, data = { trackId = args.trackId, volume = args.volume } }
end

commands.setTrackPan = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  reaper.SetMediaTrackInfo_Value(track, "D_PAN", args.pan)
  return { ok = true, data = { trackId = args.trackId, pan = args.pan } }
end

commands.listTakes = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end

  local items = {}
  local itemCount = reaper.CountTrackMediaItems(track)
  for i = 0, itemCount - 1 do
    local item = reaper.GetTrackMediaItem(track, i)
    local takeCount = reaper.CountTakes(item)
    local activeTakeIdx = -1
    local activeTake = reaper.GetActiveTake(item)

    local takes = {}
    for j = 0, takeCount - 1 do
      local take = reaper.GetMediaItemTake(item, j)
      local _, takeName = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
      local takeLen = reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
      local isActive = (take == activeTake)
      if isActive then activeTakeIdx = j end
      takes[#takes + 1] = {
        index = j,
        name = takeName,
        length = takeLen,
        isActive = isActive
      }
    end

    items[#items + 1] = {
      itemIndex = i,
      takeCount = takeCount,
      activeTakeIndex = activeTakeIdx,
      takes = takes
    }
  end

  return { ok = true, data = { trackId = args.trackId, items = items } }
end

commands.setActiveTake = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end

  local item = reaper.GetTrackMediaItem(track, args.itemIndex)
  if not item then return { ok = false, errors = {"Item not found at index " .. args.itemIndex} } end

  local take = reaper.GetMediaItemTake(item, args.takeIndex)
  if not take then return { ok = false, errors = {"Take not found at index " .. args.takeIndex} } end

  reaper.SetActiveTake(take)
  return {
    ok = true,
    data = {
      trackId = args.trackId,
      itemIndex = args.itemIndex,
      activeTakeIndex = args.takeIndex
    }
  }
end

commands.splitItemAtCursor = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end

  local item = reaper.GetTrackMediaItem(track, args.itemIndex)
  if not item then return { ok = false, errors = {"Item not found at index " .. args.itemIndex} } end

  local cursorPos = reaper.GetCursorPosition()
  local itemStart = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
  local itemEnd = itemStart + reaper.GetMediaItemInfo_Value(item, "D_LENGTH")

  if cursorPos <= itemStart or cursorPos >= itemEnd then
    return { ok = false, errors = {"Cursor is not within the item boundaries"} }
  end

  local newItem = reaper.SplitMediaItem(item, cursorPos)
  if not newItem then
    return { ok = false, errors = {"Failed to split item"} }
  end

  return {
    ok = true,
    data = {
      trackId = args.trackId,
      splitPosition = cursorPos,
      leftItemLength = cursorPos - itemStart,
      rightItemLength = itemEnd - cursorPos
    }
  }
end

commands.setLoopPoints = function(args)
  local startPos = args.start
  if startPos == nil and args.startBar ~= nil then
    startPos = barToTime(args.startBar)
  end
  local endPos = args["end"]
  if endPos == nil and args.endBar ~= nil then
    endPos = barToTime(args.endBar)
  end
  startPos = startPos or 0
  endPos = endPos or 0
  -- GetSet_LoopTimeRange(isSet, isLoop, start, end, allowAutoSeek)
  reaper.GetSet_LoopTimeRange(true, true, startPos, endPos, false)
  -- Enable or disable repeat/loop
  if args.enabled then
    reaper.SetRepeatState(1)
  else
    reaper.SetRepeatState(0)
  end
  return {
    ok = true,
    data = {
      loopStart = startPos,
      loopEnd = endPos,
      loopEnabled = args.enabled
    }
  }
end

commands.setTimeSelection = function(args)
  local startPos = args.start
  if startPos == nil and args.startBar ~= nil then
    startPos = barToTime(args.startBar)
  end
  local endPos = args["end"]
  if endPos == nil and args.endBar ~= nil then
    endPos = barToTime(args.endBar)
  end
  startPos = startPos or 0
  endPos = endPos or 0
  -- GetSet_LoopTimeRange(isSet, isLoop, start, end, allowAutoSeek)
  -- isLoop=false sets time selection rather than loop points
  reaper.GetSet_LoopTimeRange(true, false, startPos, endPos, false)
  return {
    ok = true,
    data = {
      timeSelStart = startPos,
      timeSelEnd = endPos
    }
  }
end

commands.enablePreRoll = function(args)
  local beats = args.beats or 4
  -- NOTE: Requires SWS extension for SNM_SetIntConfigVar.
  -- "projpreroll" controls the pre-roll length in beats.
  if reaper.SNM_SetIntConfigVar then
    if args.enabled then
      reaper.SNM_SetIntConfigVar("projpreroll", beats)
    else
      reaper.SNM_SetIntConfigVar("projpreroll", 0)
    end
    return {
      ok = true,
      data = {
        preRollEnabled = args.enabled,
        preRollBeats = args.enabled and beats or 0
      }
    }
  else
    return {
      ok = false,
      errors = {"SWS extension not installed — SNM_SetIntConfigVar unavailable"},
      warnings = {"Install the SWS extension for pre-roll support"}
    }
  end
end

commands.getBufferSize = function(args)
  -- Try SWS extension first for direct config access
  local bufSize = 0
  if reaper.SNM_GetIntConfigVar then
    bufSize = reaper.SNM_GetIntConfigVar("audiodev_bufsize", 0)
  end
  local sr = reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false)
  if sr == 0 then sr = 44100 end
  -- Estimated latency in ms = (bufferSize / sampleRate) * 1000
  local latency = 0
  if bufSize > 0 then
    latency = (bufSize / sr) * 1000
  end
  return {
    ok = true,
    data = {
      bufferSize = bufSize,
      sampleRate = sr,
      estimatedLatency = latency
    }
  }
end

commands.getDiskSpace = function(args)
  -- NOTE: Lua has limited native disk access. We return the recording path
  -- from the project settings but cannot reliably query free disk space
  -- across platforms without an external library.
  local projPath = reaper.GetProjectPath("")
  return {
    ok = true,
    data = {
      recordingPath = projPath,
      note = "Disk space query not available from Lua; check OS tools"
    },
    warnings = {"Disk space reporting requires OS-level access not available in ReaScript Lua"}
  }
end

commands.addTrackNote = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end

  -- Try SWS extension first (NF_SetSWSTrackNotes)
  if reaper.NF_SetSWSTrackNotes then
    -- Append to existing notes
    local existing = reaper.NF_GetSWSTrackNotes(track) or ""
    local newNotes
    if existing ~= "" then
      newNotes = existing .. "\n" .. args.note
    else
      newNotes = args.note
    end
    reaper.NF_SetSWSTrackNotes(track, newNotes)
    return {
      ok = true,
      data = { trackId = args.trackId, note = args.note, allNotes = newNotes }
    }
  else
    -- Fallback: store in track extended state
    local key = "SessionPilot_Notes"
    local existing = ({reaper.GetSetMediaTrackInfo_String(track, "P_EXT:" .. key, "", false)})[2] or ""
    local newNotes
    if existing ~= "" then
      newNotes = existing .. "\n" .. args.note
    else
      newNotes = args.note
    end
    reaper.GetSetMediaTrackInfo_String(track, "P_EXT:" .. key, newNotes, true)
    return {
      ok = true,
      data = { trackId = args.trackId, note = args.note, allNotes = newNotes },
      warnings = {"SWS not installed; notes stored in track extended state"}
    }
  end
end

commands.setAutoFade = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end

  -- REAPER auto-crossfade is a global project setting (Options > Crossfade),
  -- but per-item overlap behavior is controlled by item auto-fade flags.
  -- We toggle the free item positioning mode per-track by setting
  -- I_FREEMODE which controls how overlapping items behave.
  -- 0 = normal (items cannot overlap), 1 = free positioning (overlapping allowed)
  if args.enabled then
    reaper.SetMediaTrackInfo_Value(track, "I_FREEMODE", 0)
  else
    reaper.SetMediaTrackInfo_Value(track, "I_FREEMODE", 1)
  end

  return {
    ok = true,
    data = { trackId = args.trackId, autoFade = args.enabled }
  }
end

commands.listAvailableTrackTemplates = function(args)
  return {
    ok = true,
    data = {},
    warnings = {"Track template discovery is not implemented in the Lua bridge yet"}
  }
end

commands.loadTrackTemplate = function(args)
  return {
    ok = false,
    errors = {"Track template loading is not implemented in the Lua bridge yet"}
  }
end

commands.listAvailableFxChains = function(args)
  return {
    ok = true,
    data = {},
    warnings = {"FX chain discovery is not implemented in the Lua bridge yet"}
  }
end

commands.loadFxChain = function(args)
  return {
    ok = false,
    errors = {"FX chain loading is not implemented in the Lua bridge yet"}
  }
end

---------------------------------------------------------------------------
-- Transport Controls
---------------------------------------------------------------------------
commands.play = function(args)
  -- Action 1007: Transport: Play
  reaper.Main_OnCommand(1007, 0)
  local playState = reaper.GetPlayState()
  local cursor = reaper.GetPlayPosition()
  return {
    ok = true,
    data = {
      state = "playing",
      playCursor = cursor,
      description = "Playback started"
    }
  }
end

commands.stop = function(args)
  -- Action 1016: Transport: Stop
  reaper.Main_OnCommand(1016, 0)
  local cursor = reaper.GetCursorPosition()
  return {
    ok = true,
    data = {
      state = "stopped",
      playCursor = cursor,
      description = "Playback stopped"
    }
  }
end

commands.pause = function(args)
  -- Action 1008: Transport: Pause
  reaper.Main_OnCommand(1008, 0)
  local playState = reaper.GetPlayState()
  local state = "paused"
  if playState == 1 then state = "playing"
  elseif playState == 0 then state = "stopped"
  end
  local cursor = reaper.GetPlayPosition()
  return {
    ok = true,
    data = {
      state = state,
      playCursor = cursor,
      description = "Transport pause toggled"
    }
  }
end

commands.record = function(args)
  -- Action 1013: Transport: Record
  reaper.Main_OnCommand(1013, 0)
  local playState = reaper.GetPlayState()
  local cursor = reaper.GetPlayPosition()
  local state = "recording"
  if playState ~= 5 and playState ~= 6 then
    state = "playing"  -- may not have armed tracks
  end
  return {
    ok = true,
    data = {
      state = state,
      playCursor = cursor,
      description = "Recording started"
    },
    warnings = playState ~= 5 and {"No armed tracks — check that at least one track is armed for recording"} or {}
  }
end

commands.goToPosition = function(args)
  local pos = args.position
  if pos == nil and args.bar ~= nil then
    pos = barToTime(args.bar)
  end
  pos = pos or 0
  reaper.SetEditCurPos(pos, true, false)
  return {
    ok = true,
    data = {
      playCursor = pos,
      bar = args.bar,
      description = args.bar and ("Cursor moved to bar " .. args.bar) or ("Cursor moved to " .. string.format("%.2f", pos) .. "s")
    }
  }
end

commands.goToStart = function(args)
  -- Action 40042: Transport: Go to start of project
  reaper.Main_OnCommand(40042, 0)
  return {
    ok = true,
    data = {
      playCursor = 0,
      description = "Cursor moved to project start"
    }
  }
end

commands.goToEnd = function(args)
  -- Action 40043: Transport: Go to end of project
  reaper.Main_OnCommand(40043, 0)
  local cursor = reaper.GetCursorPosition()
  return {
    ok = true,
    data = {
      playCursor = cursor,
      description = "Cursor moved to project end"
    }
  }
end

---------------------------------------------------------------------------
-- Undo / Redo
---------------------------------------------------------------------------
commands.undo = function(args)
  reaper.Undo_DoUndo2(0)
  local nextUndo = reaper.Undo_CanUndo2(0)
  return {
    ok = true,
    data = {
      undone = true,
      description = nextUndo and ("Next undo: " .. nextUndo) or "Nothing left to undo"
    }
  }
end

commands.redo = function(args)
  reaper.Undo_DoRedo2(0)
  local nextRedo = reaper.Undo_CanRedo2(0)
  return {
    ok = true,
    data = {
      redone = true,
      description = nextRedo and ("Next redo: " .. nextRedo) or "Nothing left to redo"
    }
  }
end

---------------------------------------------------------------------------
-- FX Management
---------------------------------------------------------------------------
commands.getTrackFx = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  local fxCount = reaper.TrackFX_GetCount(track)
  local fxList = {}
  for i = 0, fxCount - 1 do
    local _, fxName = reaper.TrackFX_GetFXName(track, i, "")
    local enabled = reaper.TrackFX_GetEnabled(track, i)
    local _, presetName = reaper.TrackFX_GetPreset(track, i, "")
    fxList[#fxList + 1] = {
      index = i,
      name = fxName,
      bypassed = not enabled,
      presetName = presetName or ""
    }
  end
  return { ok = true, data = { trackId = args.trackId, fx = fxList } }
end

commands.removeFx = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  local fxIndex = args.fxIndex or 0
  if fxIndex < 0 or fxIndex >= reaper.TrackFX_GetCount(track) then
    return { ok = false, errors = {"FX index out of range"} }
  end
  local _, fxName = reaper.TrackFX_GetFXName(track, fxIndex, "")
  reaper.TrackFX_Delete(track, fxIndex)
  return { ok = true, data = { trackId = args.trackId, removedFx = fxName, fxIndex = fxIndex } }
end

commands.toggleFxBypass = function(args)
  local track = findTrackById(args.trackId)
  if not track then return { ok = false, errors = {"Track not found"} } end
  local fxIndex = args.fxIndex or 0
  if fxIndex < 0 or fxIndex >= reaper.TrackFX_GetCount(track) then
    return { ok = false, errors = {"FX index out of range"} }
  end
  local shouldEnable = not args.bypassed
  reaper.TrackFX_SetEnabled(track, fxIndex, shouldEnable)
  return { ok = true, data = { trackId = args.trackId, fxIndex = fxIndex, bypassed = args.bypassed } }
end

---------------------------------------------------------------------------
-- Rendering
---------------------------------------------------------------------------
commands.renderProject = function(args)
  -- Action 42230: File: Render project, using the most recent render settings
  reaper.Main_OnCommand(42230, 0)
  local projPath = reaper.GetProjectPath("")
  return {
    ok = true,
    data = {
      rendered = true,
      outputPath = projPath,
      note = "Render initiated using current render settings"
    },
    warnings = {"Render uses current project render settings. Check REAPER for completion."}
  }
end

commands.renderStems = function(args)
  -- Uses same render action; REAPER render settings must be configured for stems
  reaper.Main_OnCommand(42230, 0)
  return {
    ok = true,
    data = {
      rendered = true,
      note = "Stem render initiated. Configure REAPER render settings for stem export."
    },
    warnings = {"Stem rendering requires REAPER render settings configured for selected tracks as stems."}
  }
end

commands.goToMarker = function(args)
  local searchName = (args.name or ""):lower()
  local numMarkers, numRegions = reaper.CountProjectMarkers(0)
  -- Search markers first, then regions
  for i = 0, numMarkers + numRegions - 1 do
    local retval, isRegion, pos, rgnEnd, name, markrgnIdx = reaper.EnumProjectMarkers(i)
    if retval > 0 and name and name:lower():find(searchName, 1, true) then
      reaper.SetEditCurPos(pos, true, false)
      local markerType = isRegion and "region" or "marker"
      return { ok = true, data = { position = pos, name = name, type = markerType, description = "Moved to " .. markerType .. ": " .. name } }
    end
  end
  return { ok = false, data = nil, errors = {"No marker or region found matching \"" .. (args.name or "") .. "\""} }
end

commands.moveTrackToFolder = function(args)
  -- In REAPER, moving tracks into folders involves reordering tracks and setting folder depth.
  -- This is a simplified version that sets the parent relationship.
  local trackId = args.trackId
  local folderId = args.folderId
  -- For the file-based bridge, track reordering is complex.
  -- This command acknowledges the intent; full reordering may need manual adjustment.
  return {
    ok = true,
    data = { trackId = trackId, folderId = folderId, note = "Track folder assignment noted. Manual track reordering may be needed in REAPER." },
    warnings = {"REAPER track folder management via scripting has limitations. Verify track order in REAPER."}
  }
end

---------------------------------------------------------------------------
-- Write state snapshot
---------------------------------------------------------------------------
local function writeStateSnapshot()
  local summary = getProjectSummary()
  local markersAndRegions = getMarkersAndRegions()
  local timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
  local state = {
    connected = true,
    projectSummary = summary,
    projectName = summary.projectName,
    projectPath = summary.projectPath,
    sampleRate = summary.sampleRate,
    bpm = summary.bpm,
    transportState = summary.transportState,
    playCursor = summary.playCursor,
    playCursorBar = summary.playCursorBar,
    recordMode = summary.recordMode,
    trackCount = summary.trackCount,
    markerCount = summary.markerCount,
    regionCount = summary.regionCount,
    tracks = listTracks(),
    selectedTrack = getSelectedTrack(),
    markersAndRegions = markersAndRegions,
    markers = markersAndRegions.markers,
    regions = markersAndRegions.regions,
    timestamp = timestamp,
    lastUpdated = timestamp
  }
  writeFile(STATE_FILE, jsonEncode(state))
end

---------------------------------------------------------------------------
-- Process pending commands
---------------------------------------------------------------------------
local function processCommands()
  local files = listFiles(COMMAND_DIR)
  for _, filename in ipairs(files) do
    local filepath = COMMAND_DIR .. filename
    local content = readFile(filepath)
    if content then
      local cmd = jsonDecode(content)
      if cmd and cmd.command then
        local handler = commands[cmd.command]
        local result
        if handler then
          local ok, res = pcall(handler, cmd.args or {})
          if ok then
            result = res
          else
            result = { ok = false, errors = {tostring(res)} }
          end
        else
          result = { ok = false, errors = {"Unknown command: " .. cmd.command} }
        end

        result.requestId = cmd.requestId
        result.timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
        result.warnings = result.warnings or {}
        result.errors = result.errors or {}

        writeFile(RESULT_DIR .. cmd.requestId .. ".json", jsonEncode(result))
      end
      deleteFile(filepath)
    end
  end
end

---------------------------------------------------------------------------
-- Main loop (called by REAPER defer)
---------------------------------------------------------------------------
local lastStateWrite = 0

local function mainLoop()
  processCommands()

  local now = reaper.time_precise()
  if now - lastStateWrite >= STATE_INTERVAL then
    writeStateSnapshot()
    lastStateWrite = now
  end

  reaper.defer(mainLoop)
end

---------------------------------------------------------------------------
-- Initialize
---------------------------------------------------------------------------
ensureDir(BRIDGE_DIR)
ensureDir(COMMAND_DIR)
ensureDir(RESULT_DIR)
reaper.ShowConsoleMsg("SessionPilot Bridge started\n")
mainLoop()
