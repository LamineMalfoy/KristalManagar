-- phpMyAdmin SQL Dump
-- version 5.0.4deb2+deb11u1
-- https://www.phpmyadmin.net/
--
-- Хост: localhost
-- Время создания: Дек 05 2024 г., 18:43
-- Версия сервера: 10.5.26-MariaDB-0+deb11u2
-- Версия PHP: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `cleverupdate`
--

-- --------------------------------------------------------

--
-- Структура таблицы `agents`
--

CREATE TABLE `agents` (
  `user_id` int(11) NOT NULL,
  `agent_access` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Дамп данных таблицы `agents`
--

INSERT INTO `agents` (`user_id`, `agent_access`) VALUES
(696144289, 1);

-- --------------------------------------------------------

--
-- Структура таблицы `Companies`
--

CREATE TABLE `Companies` (
  `id` int(11) DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `phone` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `conference`
--

CREATE TABLE `conference` (
  `conference_id` int(11) NOT NULL,
  `games` int(11) DEFAULT 0,
  `kick_leave` int(11) DEFAULT 0,
  `rules` text DEFAULT NULL,
  `public` text DEFAULT NULL,
  `uniquekey` text DEFAULT NULL,
  `hello_text` text DEFAULT NULL,
  `stickers` int(11) NOT NULL DEFAULT 0,
  `docs` int(11) NOT NULL DEFAULT 0,
  `reposts` int(11) NOT NULL DEFAULT 0,
  `links` int(11) NOT NULL DEFAULT 0,
  `images` int(11) NOT NULL DEFAULT 0,
  `groups` int(11) NOT NULL DEFAULT 0,
  `video` int(11) NOT NULL DEFAULT 0,
  `cooldown` int(11) NOT NULL DEFAULT 0,
  `spam` int(11) NOT NULL DEFAULT 1,
  `system_notifications_enabled` tinyint(1) DEFAULT 1,
  `notifications` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `pools`
--

CREATE TABLE `pools` (
  `id` int(11) NOT NULL,
  `pool_name` varchar(255) NOT NULL,
  `pool_key` varchar(255) NOT NULL,
  `pool_peerIds` text NOT NULL,
  `creator_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Дамп данных таблицы `pools`
--

INSERT INTO `pools` (`id`, `pool_name`, `pool_key`, `pool_peerIds`, `creator_id`, `created_at`) VALUES
(2, 'ROYALRED', '2f5963b7fc', '[2000000032,2000000033,2000000034]', 590014873, '2024-10-15 08:10:53'),
(3, 'test', 'fe6c8d02de', '[2000000017,693223611,2000000129,2000000128,2000000127,2000000126]', 693223611, '2024-10-15 15:08:22'),
(4, 'sperma', '753f7fc79a', '[549678497,2000000030]', 549678497, '2024-10-15 15:10:06'),
(5, 'BruhSdoh', 'ff28ccd318', '[2000000048]', 596704448, '2024-10-20 11:37:52'),
(6, 'eblani', 'be0784ade8', '[2000000049]', 694618327, '2024-10-20 14:28:06'),
(7, 'Clever.', 'a51294f2a5', '[2000000068]', 739732077, '2024-10-24 15:04:03'),
(8, 'gangbang', '51cb131090', '[2000000081,2000000080]', 259186951, '2024-10-25 21:12:03'),
(9, 'MATRESHKA', '94c0c4784d', '[2000000089,2000000083,2000000084,2000000085,2000000086,2000000087,2000000088]', 701588006, '2024-10-26 00:46:57'),
(10, 'ban', 'a497fdffa0', '[2000000091]', 779929962, '2024-10-26 12:49:38'),
(11, 'rodinaspace', 'b0e774a706', '[2000000125]', 693223611, '2024-11-25 20:13:30'),
(12, 'Naven', 'fa723f8145', '[2000000104,2000000141,2000000139,2000000140]', 554867369, '2024-11-27 15:28:43');

-- --------------------------------------------------------

--
-- Структура таблицы `servers`
--

CREATE TABLE `servers` (
  `server_ip` varchar(64) DEFAULT NULL,
  `server_port` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `sysbanned`
--

CREATE TABLE `sysbanned` (
  `user_id` int(11) NOT NULL,
  `reason` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Структура таблицы `tech`
--

CREATE TABLE `tech` (
  `user_id` int(11) DEFAULT NULL,
  `access` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Дамп данных таблицы `tech`
--

INSERT INTO `tech` (`user_id`, `access`) VALUES
(549678497, 4),
(693223611, 3),
(856052893, 5);

-- --------------------------------------------------------

--
-- Структура таблицы `testers`
--

CREATE TABLE `testers` (
  `id` int(11) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `tester_access` tinyint(4) NOT NULL DEFAULT 1,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Дамп данных таблицы `testers`
--

INSERT INTO `testers` (`id`, `user_id`, `tester_access`, `assigned_at`) VALUES
(1, 739732077, 1, '2024-10-20 20:48:02'),
(2, 736100964, 1, '2024-10-25 21:41:19');

-- --------------------------------------------------------

--
-- Структура таблицы `vip_users`
--

CREATE TABLE `vip_users` (
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `agents`
--
ALTER TABLE `agents`
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `agent_access` (`agent_access`);

--
-- Индексы таблицы `conference`
--
ALTER TABLE `conference`
  ADD PRIMARY KEY (`conference_id`);

--
-- Индексы таблицы `pools`
--
ALTER TABLE `pools`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `servers`
--
ALTER TABLE `servers`
  ADD UNIQUE KEY `server_ip` (`server_ip`),
  ADD KEY `server_port` (`server_port`) USING BTREE;

--
-- Индексы таблицы `sysbanned`
--
ALTER TABLE `sysbanned`
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Индексы таблицы `tech`
--
ALTER TABLE `tech`
  ADD UNIQUE KEY `qwe` (`user_id`),
  ADD UNIQUE KEY `2` (`access`);

--
-- Индексы таблицы `testers`
--
ALTER TABLE `testers`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `vip_users`
--
ALTER TABLE `vip_users`
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `pools`
--
ALTER TABLE `pools`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT для таблицы `testers`
--
ALTER TABLE `testers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
